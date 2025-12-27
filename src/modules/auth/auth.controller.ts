import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { AUTH_SERVICE } from './interfaces/auth-service/auth-service.interface';
import type { IAuthService } from './interfaces/auth-service/auth-service.interface';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Register new advertiser' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Email already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login to get Access Token' })
  @ApiResponse({ status: 200, description: 'Return Access Token' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current logged in user profile' })
  async getProfile(@CurrentUser() user: User) {
    return user;
  }
}
