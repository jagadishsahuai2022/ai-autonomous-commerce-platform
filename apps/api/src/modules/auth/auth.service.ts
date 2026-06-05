import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../services/prisma.service';
import { LoggerService } from '../../common/logger.service';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  InternalServerException,
} from '../../common/exceptions/app.exception';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');
  private readonly appLogger = new LoggerService();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register a new user
   * Security: Password hashing with bcrypt
   */
  async register(registerDto: RegisterDto) {
    try {
      const { email, name, password } = registerDto;

      // Check if user already exists
      const existingUser = await this.prisma.findUserByEmail(email);
      if (existingUser) {
        throw new ConflictException('User with this email already exists', { email });
      }

      // Hash password securely
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const user = await this.prisma.createUser({
        email,
        name,
        passwordHash,
      });

      // Generate JWT (mock - use @nestjs/jwt in production)
      const token = this.generateToken(user.id, user.email);

      this.appLogger.log('User registered successfully', {
        userId: user.id,
        email: user.email,
      });

      // Don't expose password hash
      return {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          dcRole: (user as any).role || 'customer',
          subscription: (user as any).subscriptionPlan || 'BASIC',
        },
        expiresIn: 3600,
      };
    } catch (error) {
      this.logger.error('Error registering user', (error as any).stack);

      if (error instanceof ConflictException) {
        throw error;
      }

      throw new InternalServerException('Failed to register user');
    }
  }

  /**
   * Login user
   * Security: Password comparison with bcrypt
   */
  async login(loginDto: LoginDto) {
    try {
      const { email, password } = loginDto;

      // Find user by email
      const user = await this.prisma.findUserByEmail(email);
      if (!user) {
        // Don't reveal whether email exists (security best practice)
        throw new UnauthorizedException('Invalid email or password', { email });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, (user as any).passwordHash);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid email or password', { email });
      }

      // Generate JWT
      const token = this.generateToken(user.id, user.email);

      this.appLogger.log('User logged in', {
        userId: user.id,
        email: user.email,
      });

      // Don't expose password hash
      return {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: (user as any).name,
          dcRole: (user as any).role || 'customer',
          subscription: (user as any).subscriptionPlan || 'BASIC',
        },
        expiresIn: 3600,
      };
    } catch (error) {
      this.logger.error('Error logging in user', (error as any).message);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerException('Failed to login');
    }
  }

  /**
   * Generate JWT token (mock implementation)
   * In production, use JwtService from @nestjs/jwt
   */
  private generateToken(userId: number, email: string): string {
    // Mock JWT - replace with real implementation
    return Buffer.from(JSON.stringify({ userId, email, iat: Date.now() })).toString('base64');
  }

  /**
   * Forgot password - Send reset code to user's email
   */
  async forgotPassword(forgotPasswordDto: any) {
    try {
      const { email } = forgotPasswordDto;

      // Check if user exists
      const user = await this.prisma.findUserByEmail(email);
      if (!user) {
        // Don't reveal whether email exists (security best practice)
        return {
          success: true,
          message: 'If account exists, reset code will be sent to email',
        };
      }

      // Generate reset token (6-digit code for demo, use proper JWT in production)
      const resetCode = Math.random().toString().slice(2, 8).padStart(6, '0');
      const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store reset token (in production, use database)
      // For demo, store in memory with expiry
      (global as any).resetTokens = (global as any).resetTokens || {};
      (global as any).resetTokens[resetCode] = {
        email,
        userId: user.id,
        expiresAt: resetTokenExpiry,
      };

      // In production, send email with reset code
      this.appLogger.log('Password reset code generated', {
        email,
        expiresIn: '15 minutes',
      });

      return {
        success: true,
        message: 'Reset code sent to email',
        // For demo purposes only - remove in production
        _demo: {
          resetCode,
          expiresAt: resetTokenExpiry,
        },
      };
    } catch (error) {
      this.logger.error('Error in forgotPassword', (error as any).stack);
      throw new InternalServerException('Failed to process password reset');
    }
  }

  /**
   * Reset password - Validate reset code and update password
   */
  async resetPassword(resetPasswordDto: any) {
    try {
      const { token, newPassword } = resetPasswordDto;

      // Validate token
      const resetData = (global as any).resetTokens?.[token];
      if (!resetData) {
        throw new UnauthorizedException('Invalid or expired reset code');
      }

      if (new Date() > resetData.expiresAt) {
        delete (global as any).resetTokens[token];
        throw new UnauthorizedException('Reset code has expired');
      }

      // Hash new password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update user password
      const user = await this.prisma.findUserById(resetData.userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Update password in database (mock - use prisma in production)
      this.appLogger.log('Password reset successful', {
        userId: resetData.userId,
        email: resetData.email,
      });

      // Clean up reset token
      delete (global as any).resetTokens[token];

      return {
        success: true,
        message: 'Password reset successfully',
      };
    } catch (error) {
      this.logger.error('Error in resetPassword', (error as any).stack);

      if (error instanceof UnauthorizedException || error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerException('Failed to reset password');
    }
  }

  /**
   * Verify reset token validity
   */
  async verifyResetToken(token: string) {
    try {
      const resetData = (global as any).resetTokens?.[token];

      if (!resetData) {
        return { valid: false, message: 'Invalid reset code' };
      }

      if (new Date() > resetData.expiresAt) {
        delete (global as any).resetTokens[token];
        return { valid: false, message: 'Reset code has expired' };
      }

      return {
        valid: true,
        email: resetData.email,
        expiresAt: resetData.expiresAt,
      };
    } catch (error) {
      this.logger.error('Error verifying reset token', (error as any).stack);
      return { valid: false, message: 'Error verifying token' };
    }
  }

  /**
   * Handle Google OAuth login/signup
   * In production, exchange code for access token from Google
   */
  async handleGoogleOAuth(code: string) {
    try {
      // In production:
      // 1. Exchange code for access token
      // 2. Get user profile from Google API
      // 3. Create or update user in database
      // 4. Return JWT token

      // For demo, use mock data
      const mockGoogleUser = {
        id: 'google_' + Math.random().toString().slice(2, 8),
        email: 'demo-google@example.com',
        name: 'Google User',
      };

      // Check if user exists, create if not
      const user = await this.prisma.findUserByEmail(mockGoogleUser.email);
      let finalUser = user;

      if (!user) {
        finalUser = await this.prisma.createUser({
          email: mockGoogleUser.email,
          name: mockGoogleUser.name,
          passwordHash: 'oauth_google', // Mark as OAuth user
        });
      }

      const token = this.generateToken(finalUser.id, finalUser.email);

      this.appLogger.log('Google OAuth login successful', {
        email: finalUser.email,
      });

      return {
        success: true,
        token,
        user: {
          id: finalUser.id,
          email: finalUser.email,
          name: finalUser.name,
        },
        expiresIn: 3600,
      };
    } catch (error) {
      this.logger.error('Error in Google OAuth', (error as any).stack);
      throw new InternalServerException('OAuth login failed');
    }
  }

  /**
   * Handle Microsoft OAuth login/signup
   * In production, exchange code for access token from Microsoft
   */
  async handleMicrosoftOAuth(code: string) {
    try {
      // In production:
      // 1. Exchange code for access token
      // 2. Get user profile from Microsoft Graph API
      // 3. Create or update user in database
      // 4. Return JWT token

      // For demo, use mock data
      const mockMicrosoftUser = {
        id: 'microsoft_' + Math.random().toString().slice(2, 8),
        email: 'demo-microsoft@example.com',
        name: 'Microsoft User',
      };

      // Check if user exists, create if not
      const user = await this.prisma.findUserByEmail(mockMicrosoftUser.email);
      let finalUser = user;

      if (!user) {
        finalUser = await this.prisma.createUser({
          email: mockMicrosoftUser.email,
          name: mockMicrosoftUser.name,
          passwordHash: 'oauth_microsoft', // Mark as OAuth user
        });
      }

      const token = this.generateToken(finalUser.id, finalUser.email);

      this.appLogger.log('Microsoft OAuth login successful', {
        email: finalUser.email,
      });

      return {
        success: true,
        token,
        user: {
          id: finalUser.id,
          email: finalUser.email,
          name: finalUser.name,
        },
        expiresIn: 3600,
      };
    } catch (error) {
      this.logger.error('Error in Microsoft OAuth', (error as any).stack);
      throw new InternalServerException('OAuth login failed');
    }
  }
}
