import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

export class PublisherReportQueryDto {
  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Start date for report (inclusive)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-01-31',
    description: 'End date for report (inclusive)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
