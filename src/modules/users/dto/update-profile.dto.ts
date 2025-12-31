import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, IsPhoneNumber } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Full name of the user' })
  @IsOptional()
  @IsString()
  @Length(3, 100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Phone number (Indonesian format recommended)',
    example: '081234567890',
  })
  @IsOptional()
  @IsString()
  @Length(9, 15)
  @IsPhoneNumber('ID')
  phone?: string;
}
