import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';

export class AssignPropertyDto {
  @ApiPropertyOptional({
    description: 'Property ID to assign (or null to unassign)',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  propertyId?: number | null;
}
