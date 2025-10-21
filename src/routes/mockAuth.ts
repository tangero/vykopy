// Mock authentication routes for testing without database
import { Router, Request, Response } from 'express';
import { MockAuthService } from '../services/mockAuthService';
import { body, validationResult } from 'express-validator';

const router = Router();

// Register endpoint
router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('firstName').trim().isLength({ min: 1 }),
    body('lastName').trim().isLength({ min: 1 }),
    body('organization').optional().trim(),
    body('role').optional().isIn(['regional_admin', 'municipal_coordinator', 'applicant'])
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email, password, firstName, lastName, role, organization } = req.body;

      const user = await MockAuthService.register({
        email,
        password,
        firstName,
        lastName,
        role,
        organization
      });

      // Don't return password hash
      const { password_hash, ...userResponse } = user;

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: { user: userResponse }
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Registration failed'
      });
    }
  }
);

// Login endpoint
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email, password } = req.body;

      const { user, token } = await MockAuthService.login(email, password);

      // Don't return password hash
      const { password_hash, ...userResponse } = user;

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: userResponse,
          token
        }
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
  }
);

// Get current user endpoint
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const decoded = MockAuthService.verifyToken(token);
    const user = await MockAuthService.getUserById(decoded.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Don't return password hash
    const { password_hash, ...userResponse } = user;

    res.json({
      success: true,
      data: { user: userResponse }
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// Logout endpoint (client-side only for JWT)
router.post('/logout', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

export default router;