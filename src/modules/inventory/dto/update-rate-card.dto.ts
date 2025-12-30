import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateRateCardDto {
  @ApiPropertyOptional({ description: 'Harga per hari baru', minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  pricePerDay?: number;

  @ApiPropertyOptional({ description: 'Status aktif/non-aktif' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
