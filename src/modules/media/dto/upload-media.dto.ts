import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UploadMediaDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file!: Express.Multer.File;

  @ApiPropertyOptional({ type: 'string', example: 'iklan lebaran tahun 2026' })
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

  @ApiPropertyOptional({
    type: 'string',
    example: 'promo, food, lebaran',
    description: 'Comma-separated tags for categorization',
  })
  @IsOptional()
  @IsString()
  tags?: string;
}
