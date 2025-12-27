import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateScreenDto } from './dto/create-screen.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { Roles } from '../../common/decorators/roles/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Inventory (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN) // Hanya Super Admin yang boleh akses modul ini
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // --- PROPERTY ENDPOINTS ---

  @Post('properties')
  @ApiOperation({ summary: 'Register new property' })
  @ApiResponse({ status: 201, description: 'Property created successfully' })
  createProperty(@Body() dto: CreatePropertyDto) {
    return this.inventoryService.createProperty(dto);
  }

  @Get('properties')
  @ApiOperation({ summary: 'List all properties' })
  findAllProperties() {
    return this.inventoryService.findAllProperties();
  }

  @Get('properties/:id')
  @ApiOperation({ summary: 'Get property detail with screens' })
  findOneProperty(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.findOneProperty(id);
  }

  // --- SCREEN ENDPOINTS ---

  @Post('screens')
  @ApiOperation({ summary: 'Register new screen to a property' })
  @ApiResponse({ status: 201, description: 'Screen created successfully' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  @ApiResponse({ status: 409, description: 'Screen code already exists' })
  createScreen(@Body() dto: CreateScreenDto) {
    return this.inventoryService.createScreen(dto);
  }

  @Get('screens')
  @ApiOperation({ summary: 'List all screens' })
  findAllScreens() {
    return this.inventoryService.findAllScreens();
  }
}
