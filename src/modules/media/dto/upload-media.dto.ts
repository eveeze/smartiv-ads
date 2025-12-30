import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
export class UploadMediaDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  @Allow()
  file: any;
}
