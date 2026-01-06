import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber } from 'class-validator';

export class HeartbeatDto {
  @ApiPropertyOptional({ description: 'Local IP Address of the player' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'Free storage space in bytes' })
  @IsOptional()
  @IsNumber()
  freeStorage?: number;
}
