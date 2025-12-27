import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { RoomCategory, ScreenOrientation } from '@prisma/client';

export class CreateScreenDto {
  @ApiProperty({ example: 1, description: 'ID of the Property' })
  @IsNotEmpty()
  @IsNumber()
  propertyId: number;

  @ApiProperty({
    example: 'AA:BB:CC:DD:EE:FF',
    description: 'Unique Device ID / MAC Address',
  })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ example: 'TV Lobby Utama' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ enum: ScreenOrientation, example: 'LANDSCAPE' })
  @IsOptional()
  @IsEnum(ScreenOrientation)
  orientation?: ScreenOrientation;

  @ApiPropertyOptional({ enum: RoomCategory, example: 'LOBBY' })
  @IsOptional()
  @IsEnum(RoomCategory)
  roomCategory?: RoomCategory;
}
