import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../../providers/prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategies';
import { AUTH_SERVICE } from './interfaces/auth-service/auth-service.interface';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret')!,
        signOptions: {
          // [FIX] Tambahkan 'as any' untuk mengatasi error TypeScript 2322
          // Masalah ini terjadi karena definisi tipe 'expiresIn' di library terkadang konflik dengan string biasa
          expiresIn: configService.get<string>('jwt.expiresIn') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Provider alias agar bisa di-inject menggunakan token interface 'AUTH_SERVICE'
    {
      provide: AUTH_SERVICE,
      useExisting: AuthService,
    },
    JwtStrategy,
  ],
  exports: [AuthService, AUTH_SERVICE],
})
export class AuthModule {}
