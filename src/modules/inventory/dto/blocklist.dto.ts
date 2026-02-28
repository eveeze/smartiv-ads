import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, ArrayMinSize } from 'class-validator';

export class UpdateBlocklistDto {
  @ApiProperty({
    type: [Number],
    example: [1, 2, 5],
    description: 'Array of IndustryCategory IDs to block',
  })
  @IsArray()
  @ArrayMinSize(0)
  @IsInt({ each: true })
  categoryIds!: number[];
}
