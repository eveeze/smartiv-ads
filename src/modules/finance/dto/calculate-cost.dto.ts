import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsDateString, IsInt } from 'class-validator';

export class CalculateCostDto {
  @ApiProperty({
    description: 'List ID layar yang dipilih untuk campaign',
    type: [Number],
    example: [1, 2, 3],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  screenIds: number[];

  @ApiProperty({ example: '2025-12-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2025-12-07' })
  @IsDateString()
  endDate: string;
}
