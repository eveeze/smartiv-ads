import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PageOptionsDto } from '../../../common/dto/page-options.dto';

export class ScreenPageOptionsDto extends PageOptionsDto {
  @ApiPropertyOptional({ description: 'Filter by Property ID' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  readonly propertyId?: number;
}
