import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule], // StorageService butuh ConfigService
  providers: [StorageService],
  exports: [StorageService], // <--- PENTING: Harus di-export agar module lain bisa pakai
})
export class StorageModule {}
