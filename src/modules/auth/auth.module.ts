import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../../providers/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategies';
import { MailModule } from '../mail/mail.module';
import { AUTH_SERVICE } from './interfaces/auth-service/auth-service.interface'; // [1] Import Token

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    MailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, // [2] Provider Class (untuk JwtStrategy dll)
    {
      provide: AUTH_SERVICE,
      useExisting: AuthService, // [3] Provider Alias (untuk AuthController)
    },
    JwtStrategy,
  ],
  exports: [AuthService, AUTH_SERVICE], // [4] Export keduanya agar aman
})
export class AuthModule {}
