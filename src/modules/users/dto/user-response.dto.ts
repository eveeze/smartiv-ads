import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Exclude, Expose, Transform, Type } from 'class-transformer';

// --- Sub-DTOs Definition ---
// Mendefinisikan struktur object nested agar tidak menggunakan 'any'

@Exclude()
export class WalletResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty({ example: 500000, description: 'Current active balance' })
  @Expose()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'bigint' ? Number(value) : (value as number),
  ) // Handle BigInt
  balance: number;

  @ApiProperty({
    example: 0,
    description: 'Frozen balance for active campaigns',
  })
  @Expose()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'bigint' ? Number(value) : (value as number),
  ) // Handle BigInt
  frozenBalance: number;
}

@Exclude()
export class PropertySimpleDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  name: string;
}

@Exclude()
export class UserCountDto {
  @ApiProperty()
  @Expose()
  campaigns: number;

  @ApiProperty()
  @Expose()
  media: number;
}

// --- Main User Response DTO ---

@Exclude()
export class UserResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  email: string;

  @ApiProperty({ nullable: true })
  @Expose()
  name: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  phone: string | null;

  @ApiProperty({ enum: Role })
  @Expose()
  role: Role;

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty({ nullable: true })
  @Expose()
  propertyId: number | null;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  // [UPDATED] Menggunakan tipe spesifik WalletResponseDto
  @ApiProperty({ required: false, type: WalletResponseDto })
  @Expose()
  @Type(() => WalletResponseDto)
  wallet?: WalletResponseDto;

  // [UPDATED] Menggunakan tipe spesifik PropertySimpleDto
  @ApiProperty({ required: false, type: PropertySimpleDto })
  @Expose()
  @Type(() => PropertySimpleDto)
  property?: PropertySimpleDto;

  // [UPDATED] Menggunakan tipe spesifik UserCountDto
  @ApiProperty({ required: false, type: UserCountDto })
  @Expose()
  @Type(() => UserCountDto)
  _count?: UserCountDto;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
