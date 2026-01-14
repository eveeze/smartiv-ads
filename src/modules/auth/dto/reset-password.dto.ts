import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'abcdef123456...',
    description: 'Token from email URL',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'NewPasswordStrong!@#', description: 'New password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}
