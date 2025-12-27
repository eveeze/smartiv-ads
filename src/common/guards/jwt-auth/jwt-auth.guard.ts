import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
// Menggunakan 'jwt' sesuai nama yang didefinisikan di JwtStrategy
export class JwtAuthGuard extends AuthGuard('jwt') {}
