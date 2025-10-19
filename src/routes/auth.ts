import { Router, Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { UserModel } from '../models/User';
import { loginSchema, registerSchema } from '../validation/schemas';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validatedData = loginSchema.parse(req.body);
    
    // Attempt login
    const loginResponse = await AuthService.login(validatedData);
    
    res.json({
      success: true,
      data: loginResponse,
    });
  } catch (error) {
    console.error('Login error:', error);
    
    res.status(401).json({
      error: {
        code: 'LOGIN_FAILED',
        message: error instanceof Error ? error.message : 'Login failed',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validatedData = registerSchema.parse(req.body);
    
    // Register new user
    const newUser = await AuthService.register(validatedData);
    
    res.status(201).json({
      success: true,
      data: {
        user: newUser,
        message: 'Registration successful. Please wait for admin approval.',
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    const statusCode = error instanceof Error && error.message.includes('already exists') ? 409 : 400;
    
    res.status(statusCode).json({
      error: {
        code: 'REGISTRATION_FAILED',
        message: error instanceof Error ? error.message : 'Registration failed',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      res.status(400).json({
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token is required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }
    
    // Refresh tokens
    const tokens = await AuthService.refreshToken(refreshToken);
    
    res.json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    
    res.status(401).json({
      error: {
        code: 'TOKEN_REFRESH_FAILED',
        message: error instanceof Error ? error.message : 'Token refresh failed',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    // Get fresh user data from database
    const user = await UserModel.findById(req.user.id);
    
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    // Get user territories if applicable
    let territories: any[] = [];
    if (user.role === 'municipal_coordinator') {
      territories = await UserModel.getUserTerritories(user.id);
    }

    res.json({
      success: true,
      data: {
        user,
        territories,
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get user information',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    // In a real implementation, you might want to blacklist the token
    // For now, we'll just return success
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    
    res.status(500).json({
      error: {
        code: 'LOGOUT_FAILED',
        message: 'Logout failed',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
});

export default router;