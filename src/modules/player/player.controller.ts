import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PlayerService } from './player.service';
import {
  ApiTags,
  ApiOperation,
  ApiHeader,
  ApiOkResponse,
} from '@nestjs/swagger';
import { PlayerAuthGuard } from './guards/player-auth.guard';
import { CurrentScreen } from '../../common/decorators/current-screen/current-screen.decorator';
import { HeartbeatDto } from './dto/heartbeat.dto';
// [FIX] Import DTO response
import { PlaylistResponseDto } from './dto/playlist.dto';
import type { Screen } from '@prisma/client';

@ApiTags('Player API (Device)')
@ApiHeader({
  name: 'X-Device-ID',
  description: 'Unique Device Identifier (MAC Address/Serial)',
  required: true,
})
@UseGuards(PlayerAuthGuard)
@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get('config')
  @ApiOperation({
    summary: 'Get player configuration (Orientation, Logo, etc)',
  })
  getConfig(@CurrentScreen() screen: Screen) {
    return this.playerService.getConfig(screen.id);
  }

  @Get('playlist')
  @ApiOperation({ summary: 'Get active playlist content for this device' })
  // [FIX] Dokumentasikan Return Type untuk Swagger
  @ApiOkResponse({
    description: 'Active playlist for current screen',
    type: PlaylistResponseDto,
  })
  getPlaylist(@CurrentScreen() screen: Screen) {
    return this.playerService.generatePlaylist(screen.id);
  }

  @Post('heartbeat')
  @ApiOperation({ summary: 'Ping server to report ONLINE status' })
  @ApiOkResponse({ description: 'Status acknowledged' })
  heartbeat(@CurrentScreen() screen: Screen, @Body() dto: HeartbeatDto) {
    return this.playerService.recordHeartbeat(screen.id, dto);
  }
}
