import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TransactionType } from '@prisma/client';
import { PageOptionsDto } from '../../../common/dto/page-options.dto';

export class TransactionQueryDto extends PageOptionsDto {
  @ApiPropertyOptional({ enum: TransactionType })
  @IsEnum(TransactionType)
  @IsOptional()
  type?: TransactionType;
}
