import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTopupDto {
  @ApiProperty({ description: 'Amount to topup (IDR)', minimum: 10000 })
  @Type(() => Number)
  @IsNumber()
  @Min(10000)
  amount: number;
}
