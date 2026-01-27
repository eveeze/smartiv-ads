import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateMediaDto {
  @ApiPropertyOptional({ type: 'string', example: 'New Title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    type: 'string',
    example: 'Updated description for the media',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://smartiv.co.id/new-promo' })
  @IsOptional()
  @IsUrl()
  actionUrl?: string;
}
