import { RegisterDto } from '../../dto/register.dto';
import { LoginDto } from '../../dto/login.dto';
import { ChangePasswordDto } from '../../dto/change-password.dto'; // [NEW] Import DTO
import { ForgotPasswordDto } from '../../dto/forgot-password.dto'; // [NEW] Import DTO
import { ResetPasswordDto } from '../../dto/reset-password.dto'; // [NEW] Import DTO
import { User } from '@prisma/client';

// 1. Injection Token
export const AUTH_SERVICE = 'AUTH_SERVICE';

// 2. Response Type Definition
export interface LoginResponse {
  accessToken: string;
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
  };
}

// 3. Interface Contract (Update Kontrak Kerja)
export interface IAuthService {
  register(registerDto: RegisterDto): Promise<Omit<User, 'password'>>;
  login(loginDto: LoginDto): Promise<LoginResponse>;

  // [NEW] Tambahkan definisi method baru di sini
  changePassword(userId: number, dto: ChangePasswordDto): Promise<void>;
  forgotPassword(dto: ForgotPasswordDto): Promise<void>;
  resetPassword(dto: ResetPasswordDto): Promise<void>;
}
