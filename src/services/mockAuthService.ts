// Mock authentication service for testing without database
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config';

interface MockUser {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  organization: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

// In-memory user storage for testing
const mockUsers: MockUser[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'admin@digikop.cz',
    password_hash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXig/8VfuFvO', // admin123
    name: 'Administrátor DigiKop',
    organization: 'Středočeský kraj',
    role: 'regional_admin',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'koordinator@praha.cz',
    password_hash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXig/8VfuFvO', // admin123
    name: 'Jan Novák',
    organization: 'Město Praha',
    role: 'municipal_coordinator',
    is_active: true,
    created_at: new Date().toISOString()
  }
];

export class MockAuthService {
  static async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
    organization?: string;
  }): Promise<MockUser> {
    // Check if user already exists
    const existingUser = mockUsers.find(u => u.email === userData.email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const password_hash = await bcrypt.hash(userData.password, config.bcrypt.rounds);

    // Create new user
    const newUser: MockUser = {
      id: `550e8400-e29b-41d4-a716-${Date.now().toString().slice(-12)}`,
      email: userData.email,
      password_hash,
      name: `${userData.firstName} ${userData.lastName}`,
      organization: userData.organization || 'Nespecifikováno',
      role: userData.role || 'applicant',
      is_active: true,
      created_at: new Date().toISOString()
    };

    mockUsers.push(newUser);
    return newUser;
  }

  static async login(email: string, password: string): Promise<{ user: MockUser; token: string }> {
    // Find user
    const user = mockUsers.find(u => u.email === email && u.is_active);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    return { user, token };
  }

  static async getUserById(id: string): Promise<MockUser | null> {
    return mockUsers.find(u => u.id === id && u.is_active) || null;
  }

  static async getUserByEmail(email: string): Promise<MockUser | null> {
    return mockUsers.find(u => u.email === email && u.is_active) || null;
  }

  static verifyToken(token: string): { userId: string; email: string; role: string } {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}