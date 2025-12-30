import { ApiProperty } from '@nestjs/swagger';

export class UploadMediaDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: any;
}
