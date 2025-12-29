import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class WithdrawalRequestDto {
  @ApiProperty({ description: 'Amount to withdraw', minimum: 50000 })
  @Type(() => Number)
  @IsNumber()
  @Min(50000) // Minimum Withdrawal
  amount: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  accountNo: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  accountName: string;
}
