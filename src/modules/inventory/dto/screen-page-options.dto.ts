import { PageOptionsDto } from '../../../common/dto/page-options.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class ScreenPageOptionsDto extends PageOptionsDto {
  @ApiPropertyOptional({
    description: 'Filter screens by Property ID',
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  readonly propertyId?: number;
}
