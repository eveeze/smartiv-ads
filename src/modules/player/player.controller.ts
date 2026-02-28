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
import { ApiStandardErrors } from '../../common/decorators/api-errors.decorator';
import { MessageResponseDto } from '../../common/dto/api-response.dto';
import { GetPlaylistDto, PlaylistResponseDto } from './dto/playlist.dto';
import { HeartbeatDto } from './dto/heartbeat.dto';

@ApiTags('Player / Device API')
@ApiBearerAuth('screen-token')
@UseGuards(PlayerAuthGuard)
@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Post('heartbeat')
  @ApiOperation({
    summary: 'Ping server & update status online',
    description:
      'Called periodically by the player device to report it is online. Updates `lastPing` and `status` fields.',
  })
  @ApiResponse({
    status: 200,
    description: 'Heartbeat acknowledged.',
    type: MessageResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Invalid heartbeat payload.',
    unauthorized: 'Missing or invalid X-Device-ID header.',
    forbidden: false,
    notFound: false,
  })
  async heartbeat(@CurrentScreen() screen: Screen, @Body() dto: HeartbeatDto) {
    return this.playerService.heartbeat(screen, dto);
  }

  @Get('config')
  @ApiOperation({
    summary: 'Get device configuration (Timezone, Orientation)',
    description:
      'Returns the screen configuration including timezone, orientation, and associated property details.',
  })
  @ApiResponse({
    status: 200,
    description: 'Screen configuration object.',
    type: Object,
  })
  @ApiStandardErrors({
    badRequest: false,
    unauthorized: 'Missing or invalid X-Device-ID header.',
    forbidden: false,
    notFound: false,
  })
  async getConfig(@CurrentScreen() screen: Screen) {
    return this.playerService.getConfig(screen);
  }

  @Get('playlist')
  @ApiOperation({
    summary: 'Get active campaign playlist filtered by Slot',
    description:
      'Returns the list of active campaign media items to play, filtered by the requested ad slot (e.g., FULLSCREEN, BANNER).',
  })
  @ApiResponse({
    status: 200,
    type: PlaylistResponseDto,
    description: 'Array of playlist items with presigned media URLs.',
  })
  @ApiStandardErrors({
    badRequest: 'Invalid slot parameter.',
    unauthorized: 'Missing or invalid X-Device-ID header.',
    forbidden: false,
    notFound: false,
  })
  async getPlaylist(
    @CurrentScreen() screen: Screen,
    @Query() query: GetPlaylistDto,
  ) {
    return this.playerService.getPlaylist(screen, query);
  }
}
