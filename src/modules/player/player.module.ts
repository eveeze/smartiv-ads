import { Module } from '@nestjs/common';
import { PlayerService } from './player.service';
import { PlayerController } from './player.controller';
// [FIX] Import PrismaModule agar PrismaService tersedia
import { PrismaModule } from '../../providers/prisma/prisma.module';

@Module({
  imports: [PrismaModule], // [FIX] Tambahkan di sini
  controllers: [PlayerController],
  providers: [PlayerService],
})
export class PlayerModule {}
