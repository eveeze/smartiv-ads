import { RegisterDto } from '../../dto/register.dto';
import { LoginDto } from '../../dto/login.dto';
import { User } from '@prisma/client';
import { JwtPayload } from '../jwt-payload/jwt-payload.interface';
// 1. Injection Token (Kupon Unik)
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

// 3. Interface Contract (Kontrak Kerja)
export interface IAuthService {
  register(registerDto: RegisterDto): Promise<Omit<User, 'password'>>;
  login(loginDto: LoginDto): Promise<LoginResponse>;
}
