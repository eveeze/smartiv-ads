import { ApiProperty } from '@nestjs/swagger';
import { ApprovalStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, ValidateIf } from 'class-validator';

export class ReviewMediaDto {
  @ApiProperty({
    enum: ApprovalStatus,
    description: 'Status keputusan admin (APPROVED / REJECTED)',
    example: ApprovalStatus.APPROVED,
  })
  @IsEnum(ApprovalStatus, {
    message: 'Status must be either APPROVED or REJECTED',
  })
  status: ApprovalStatus;

  @ApiProperty({
    description: 'Alasan penolakan (Wajib jika status REJECTED)',
    required: false,
    example: 'Kualitas gambar terlalu rendah/blur',
  })
  @ValidateIf((o: ReviewMediaDto) => o.status === ApprovalStatus.REJECTED) // Validasi kondisional
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required when rejecting media' })
  rejectionReason?: string;
}
