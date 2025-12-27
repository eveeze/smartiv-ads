import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'advertiser@smartiv.com',
    description: 'Email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'SuperSecret123!',
    description: 'Minimum 6 characters',
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'John Doe', description: 'Full Name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '081234567890',
    description: 'Phone Number (Optional)',
    required: false,
  })
  @IsString()
  @IsNotEmpty() // Bisa diganti @IsOptional() jika tidak wajib
  phone: string;
}
