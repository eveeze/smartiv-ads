import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsOptional, IsString, IsUrl } from 'class-validator';
export class UploadMediaDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  @Allow()
  file: any;

  @ApiPropertyOptional({ type: 'string', example: 'iklan lebarah ntahun 2026' })
  @IsOptional()
  @IsString()
  title?: string;
  @ApiPropertyOptional({
    type: 'string',
    example: 'video promosi untuk diskon 20% all item',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://smartiv.co.id/promo' })
  @IsOptional()
  @IsUrl()
  actionUrl?: string;
}
