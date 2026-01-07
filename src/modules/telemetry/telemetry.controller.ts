import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiHeader,
  ApiAcceptedResponse,
} from '@nestjs/swagger';
import { TelemetryService } from './telemetry.service';
import { CreateImpressionLogDto } from './dto/create-impression.dto';
// [FIX] Gunakan relative import
import { PlayerAuthGuard } from '../player/guards/player-auth.guard';
import { CurrentScreen } from '../../common/decorators/current-screen/current-screen.decorator';
import type { Screen } from '@prisma/client';

@ApiTags('Telemetry (Data Ingest)')
@ApiHeader({
  name: 'X-Device-ID',
  description: 'Unique Device Identifier',
  required: true,
})
@UseGuards(PlayerAuthGuard)
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('impression')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Ingest impression logs from player' })
  @ApiAcceptedResponse({ description: 'Logs queued for processing' })
  async ingest(
    @CurrentScreen() screen: Screen,
    @Body() dto: CreateImpressionLogDto,
  ) {
    return this.telemetryService.ingestImpressions(screen.id, dto);
  }
}
