// src/modules/player/player.controller.ts
import { Controller, Get, UseGuards, Query, Post, Body } from '@nestjs/common';
import { PlayerService } from './player.service';
import { PlayerAuthGuard } from './guards/player-auth.guard';
import { CurrentScreen } from '../../common/decorators/current-screen/current-screen.decorator';
// [FIX] Gunakan 'import type' untuk interface Prisma agar TS tidak error pada decorator metadata
import type { Screen } from '@prisma/client';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { GetPlaylistDto, PlaylistResponseDto } from './dto/playlist.dto';
import { HeartbeatDto } from './dto/heartbeat.dto';

@ApiTags('Player / Device API')
@ApiBearerAuth('screen-token')
@UseGuards(PlayerAuthGuard)
@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Post('heartbeat')
  @ApiOperation({ summary: 'Ping server & update status online' })
  async heartbeat(@CurrentScreen() screen: Screen, @Body() dto: HeartbeatDto) {
    return this.playerService.heartbeat(screen, dto);
  }

  @Get('config')
  @ApiOperation({ summary: 'Get device configuration (Timezone, Orientation)' })
  async getConfig(@CurrentScreen() screen: Screen) {
    return this.playerService.getConfig(screen);
  }

  @Get('playlist')
  @ApiOperation({ summary: 'Get active campaign playlist filtered by Slot' })
  @ApiResponse({ type: PlaylistResponseDto })
  async getPlaylist(
    @CurrentScreen() screen: Screen,
    @Query() query: GetPlaylistDto,
  ) {
    return this.playerService.getPlaylist(screen, query);
  }
}
