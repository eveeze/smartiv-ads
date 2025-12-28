import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateScreenDto } from './dto/create-screen.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { UpdateScreenDto } from './dto/update-screen.dto';
import { PageOptionsDto } from '../../common/dto/page-options.dto'; // Import DTO baru
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { Roles } from '../../common/decorators/roles/roles.decorator';
import { Role } from '@prisma/client';
import { ScreenPageOptionsDto } from './dto/screen-page-options.dto';

@ApiTags('Inventory (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // --- PROPERTY ---

  @Post('properties')
  @ApiOperation({ summary: 'Register new property' })
  @ApiResponse({ status: 201, description: 'Property created' })
  createProperty(@Body() dto: CreatePropertyDto) {
    return this.inventoryService.createProperty(dto);
  }

  @Get('properties')
  @ApiOperation({ summary: 'List all properties with pagination & search' })
  findAllProperties(
    @Query(new ValidationPipe({ transform: true }))
    pageOptionsDto: PageOptionsDto,
  ) {
    return this.inventoryService.findAllProperties(pageOptionsDto);
  }

  @Get('properties/:id')
  findOneProperty(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.findOneProperty(id);
  }

  @Patch('properties/:id')
  @ApiOperation({ summary: 'Update property details' })
  updateProperty(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.inventoryService.updateProperty(id, dto);
  }

  @Delete('properties/:id')
  @ApiOperation({ summary: 'Delete property' })
  removeProperty(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.removeProperty(id);
  }

  // --- SCREEN ---

  @Post('screens')
  @ApiOperation({ summary: 'Add screen to property' })
  createScreen(@Body() dto: CreateScreenDto) {
    return this.inventoryService.createScreen(dto);
  }
  @Get('screens')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_OPERATOR)
  @ApiOperation({ summary: 'List Screens (Filter by Property)' })
  findAllScreens(@Query() pageOptionsDto: ScreenPageOptionsDto) {
    return this.inventoryService.findAllScreens(pageOptionsDto);
  }

  @Get('screens/:id')
  findOneScreen(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.findOneScreen(id);
  }

  @Patch('screens/:id')
  updateScreen(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScreenDto,
  ) {
    return this.inventoryService.updateScreen(id, dto);
  }

  @Delete('screens/:id')
  removeScreen(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.removeScreen(id);
  }
}
