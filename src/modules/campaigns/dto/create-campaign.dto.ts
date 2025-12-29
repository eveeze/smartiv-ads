import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Ramadhan Promo 2025' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '2025-03-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2025-03-30' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'ID Media yang sudah Approved', example: 1 })
  @IsInt()
  mediaId: number;

  @ApiProperty({ description: 'List ID Screen yang ditarget', example: [1, 2] })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  screenIds: number[];
}
