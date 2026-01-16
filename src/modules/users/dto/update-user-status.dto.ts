import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({ example: true, description: 'Set false to block user' })
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}
