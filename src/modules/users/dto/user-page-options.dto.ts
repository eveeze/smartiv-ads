import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PageOptionsDto } from '../../../common/dto/page-options.dto';
import { Role } from '@prisma/client';

export class UserPageOptionsDto extends PageOptionsDto {
  @ApiPropertyOptional({ enum: Role })
  @IsEnum(Role)
  @IsOptional()
  readonly role?: Role;

  @ApiPropertyOptional({ description: 'Search by name or email' })
  @IsString()
  @IsOptional()
  readonly q?: string;
}
