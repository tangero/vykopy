import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { UserModel } from '../models/User';
import { User, JwtPayload, LoginRequest, LoginResponse, RegisterRequest } from '../types';

export class AuthService {
  // Generate JWT token
  static generateToken(user: User): string {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: '24h',
    });
  }

  // Generate refresh token (longer expiry)
  static generateRefreshToken(user: User): string {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: '7d',
    });
  }

  // Verify JWT token
  static verifyToken(token: string): JwtPayload {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  }

  // Login user
  static async login(loginData: LoginRequest): Promise<LoginResponse> {
    const { email, password } = loginData;

    // Find user by email
    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await UserModel.verifyPassword(password, (user as any).password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Remove password hash from user object
    const { password_hash, ...userWithoutPassword } = user as any;

    // Generate tokens
    const token = this.generateToken(userWithoutPassword);
    const refreshToken = this.generateRefreshToken(userWithoutPassword);

    return {
      user: userWithoutPassword,
      token,
      refreshToken,
    };
  }

  // Register new user
  static async register(registerData: RegisterRequest): Promise<User> {
    const { email, password, name, organization } = registerData;

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create new user (default role is 'applicant')
    const newUser = await UserModel.create({
      email,
      password,
      name,
      organization,
      role: 'applicant',
    });

    return newUser;
  }

  // Refresh token
  static async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      // Verify refresh token
      const decoded = this.verifyToken(refreshToken);
      
      // Get current user data
      const user = await UserModel.findById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      const newToken = this.generateToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      return {
        token: newToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  // Get current user from token
  static async getCurrentUser(token: string): Promise<User> {
    try {
      const decoded = this.verifyToken(token);
      const user = await UserModel.findById(decoded.userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Validate user permissions for action
  static validatePermissions(user: User, requiredRole: string | string[]): boolean {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return roles.includes(user.role);
  }

  // Check if user can access municipality
  static async canAccessMunicipality(userId: string, municipalityCode: string): Promise<boolean> {
    return UserModel.hasAccessToMunicipality(userId, municipalityCode);
  }
}