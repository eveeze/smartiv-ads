import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  email: string;

  // [FIX] Tambahkan '| null' karena field ini nullable di DB
  @ApiProperty({ nullable: true })
  @Expose()
  name: string | null;

  // [FIX] Tambahkan '| null'
  @ApiProperty({ nullable: true })
  @Expose()
  phone: string | null;

  @ApiProperty({ enum: Role })
  @Expose()
  role: Role;

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  @ApiProperty({ required: false })
  @Expose()
  wallet?: any;

  @ApiProperty({ required: false })
  @Expose()
  property?: any;

  @ApiProperty({ required: false })
  @Expose()
  _count?: any; // Tambahkan ini untuk handle count relation

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
