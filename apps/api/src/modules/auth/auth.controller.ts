import { Controller, Post, Body, HttpCode, HttpStatus, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SecurityService } from '../../common/services/security.service';
import {
  LoginDto,
  RegisterDto,
  AuthResponseDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly securityService: SecurityService
  ) {}

  /**
   * User login endpoint
   * Validates credentials and returns JWT token
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<any> {
    const email = this.securityService.validateEmail(loginDto.email);
    return this.authService.login({ ...loginDto, email });
  }

  /**
   * User registration endpoint
   * Creates new user with secure password hashing
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto): Promise<any> {
    const email = this.securityService.validateEmail(registerDto.email);
    const name = this.securityService.validateInput(registerDto.name, 100);
    return this.authService.register({ ...registerDto, email, name });
  }

  /**
   * Forgot password endpoint
   * Sends password reset code to user's email
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto): Promise<any> {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  /**
   * Reset password endpoint
   * Validates reset code and updates password
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<any> {
    return this.authService.resetPassword(resetPasswordDto);
  }

  /**
   * Verify reset token endpoint
   * Checks if reset token is valid and not expired
   */
  @Get('verify-reset-token')
  @HttpCode(HttpStatus.OK)
  async verifyResetToken(@Query('token') token: string): Promise<any> {
    return this.authService.verifyResetToken(token);
  }

  /**
   * OAuth Google callback endpoint
   * Handles Google OAuth token exchange
   */
  @Post('oauth/google')
  @HttpCode(HttpStatus.OK)
  async googleOAuth(@Body() body: { code: string }): Promise<any> {
    return this.authService.handleGoogleOAuth(body.code);
  }

  /**
   * OAuth Microsoft callback endpoint
   * Handles Microsoft OAuth token exchange
   */
  @Post('oauth/microsoft')
  @HttpCode(HttpStatus.OK)
  async microsoftOAuth(@Body() body: { code: string }): Promise<any> {
    return this.authService.handleMicrosoftOAuth(body.code);
  }

  /**
   * Health check for auth service
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  health(): { status: string } {
    return { status: 'Auth service is running' };
  }
}
