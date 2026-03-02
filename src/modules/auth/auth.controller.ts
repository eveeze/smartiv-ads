import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AUTH_SERVICE } from './interfaces/auth-service/auth-service.interface';
import type { IAuthService } from './interfaces/auth-service/auth-service.interface';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardErrors } from '../../common/decorators/api-errors.decorator';
import {
  LoginDataDto,
  MessageResponseDto,
} from '../../common/dto/api-response.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user/current-user.decorator';
import type { User } from '@prisma/client';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AUTH_SERVICE)
    private readonly authService: IAuthService,
  ) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register new advertiser',
    description:
      'Creates a new user account with ADVERTISER role. Returns user data on success.',
  })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered.',
    type: MessageResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Email already exists or validation failed.',
    unauthorized: false,
    forbidden: false,
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login to get Access Token',
    description:
      'Authenticates with email & password. Returns a JWT Bearer token to be used in the `Authorization` header for subsequent requests.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns `accessToken` (JWT) and `user` object.',
    type: LoginDataDto,
  })
  @ApiStandardErrors({
    badRequest: 'Missing or malformed email/password fields.',
    unauthorized: 'Invalid email or password.',
    forbidden: false,
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current logged in user profile',
    description:
      'Returns the full profile of the currently authenticated user based on the JWT token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the current user object.',
    type: UserResponseDto,
  })
  @ApiStandardErrors({
    badRequest: false,
    unauthorized: true,
    forbidden: false,
  })
  getProfile(@CurrentUser() user: User) {
    return user;
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change current user password',
    description:
      'Requires the old password for verification. Returns success message on completion.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully.',
    type: MessageResponseDto,
  })
  @ApiStandardErrors({
    badRequest:
      'Old password is incorrect or new password does not meet requirements.',
    unauthorized: true,
    forbidden: false,
  })
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset token (via email)',
    description:
      'Sends a password reset link to the provided email. Always returns 200 for security (does not reveal if email exists).',
  })
  @ApiResponse({
    status: 200,
    description:
      'Reset token sent (if email exists). Always returns 200 for security.',
    type: MessageResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Invalid email format.',
    unauthorized: false,
    forbidden: false,
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password using token',
    description:
      'Resets user password using the token received via email from the forgot-password endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password has been reset successfully.',
    type: MessageResponseDto,
  })
  @ApiStandardErrors({
    badRequest:
      'Token is invalid, expired, or new password does not meet requirements.',
    unauthorized: false,
    forbidden: false,
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
