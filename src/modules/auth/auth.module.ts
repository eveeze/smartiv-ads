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
    // 🔐 JWT Module Configuration (Best Practice)
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret')!,

        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    // 💉 Dependency Injection Decoupling
    // Controller meminta 'AUTH_SERVICE', Module memberikan Class 'AuthService'.
    {
      provide: AUTH_SERVICE,
      useClass: AuthService,
    },
    JwtStrategy,
  ],
  // Export Token agar module lain bisa menggunakan Interface IAuthService
  exports: [AUTH_SERVICE],
})
export class AuthModule {}
