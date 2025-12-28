import { PartialType } from '@nestjs/swagger';
import { CreateScreenDto } from './create-screen.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ScreenStatus } from '@prisma/client';

export class UpdateScreenDto extends PartialType(CreateScreenDto) {
  // Kita tambahkan ini agar Admin bisa mengubah status screen (misal ke MAINTENANCE)
  @ApiPropertyOptional({
    enum: ScreenStatus,
    description: 'Update status layar (ONLINE, OFFLINE, MAINTENANCE)',
  })
  @IsOptional()
  @IsEnum(ScreenStatus)
  status?: ScreenStatus;
}
