import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateScreenDto } from './dto/create-screen.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { UpdateScreenDto } from './dto/update-screen.dto';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { Roles } from '../../common/decorators/roles/roles.decorator';

// [FIX] Pisahkan import Role (Value) dan User (Type)
import { Role } from '@prisma/client';
import type { User } from '@prisma/client'; // Gunakan 'import type' agar aman dari error 1272

import { CreateRateCardDto } from './dto/create-rate-card.dto';
import { UpdateRateCardDto } from './dto/update-rate-card.dto';
import { ScreenPageOptionsDto } from './dto/screen-page-options.dto';
import { CurrentUser } from '../../common/decorators/current-user/current-user.decorator';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ... (Sisa kode ke bawah SAMA PERSIS, tidak perlu diubah) ...

  @Get('operator/screens')
  @Roles(Role.PROPERTY_OPERATOR, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get screens specific to the logged-in Operator Property',
  })
  @ApiResponse({
    status: 200,
    description: 'List of screens filtered by assigned property',
  })
  async getOperatorScreens(
    @CurrentUser() user: User,
    @Query() pageOptionsDto: ScreenPageOptionsDto,
  ) {
    let targetPropertyId = pageOptionsDto.propertyId;

    if (user.role === Role.PROPERTY_OPERATOR) {
      if (!user.propertyId) {
        throw new BadRequestException(
          'Operator account is not assigned to any property.',
        );
      }
      targetPropertyId = user.propertyId;
    }

    return this.inventoryService.findAllScreens(
      pageOptionsDto,
      targetPropertyId,
    );
  }

  @Post('properties')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create new property' })
  createProperty(@Body() createPropertyDto: CreatePropertyDto) {
    return this.inventoryService.createProperty(createPropertyDto);
  }

  @Get('properties')
  @Roles(Role.SUPER_ADMIN, Role.ADVERTISER)
  @ApiOperation({ summary: 'Get all properties with pagination' })
  findAllProperties(@Query() pageOptionsDto: PageOptionsDto) {
    return this.inventoryService.findAllProperties(pageOptionsDto);
  }

  @Get('properties/list')
  @Roles(Role.SUPER_ADMIN, Role.ADVERTISER)
  @ApiOperation({ summary: 'Get lightweight property list for dropdowns' })
  findPropertiesList() {
    return this.inventoryService.findPropertiesList();
  }

  @Get('properties/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADVERTISER)
  @ApiOperation({ summary: 'Get property details' })
  findPropertyById(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.findPropertyById(id);
  }

  @Patch('properties/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update property' })
  updateProperty(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePropertyDto: UpdatePropertyDto,
  ) {
    return this.inventoryService.updateProperty(id, updatePropertyDto);
  }

  @Delete('properties/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete property' })
  removeProperty(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.removeProperty(id);
  }

  @Post('screens')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Register new screen' })
  createScreen(@Body() createScreenDto: CreateScreenDto) {
    return this.inventoryService.createScreen(createScreenDto);
  }

  @Get('screens')
  @Roles(Role.SUPER_ADMIN, Role.ADVERTISER)
  @ApiOperation({ summary: 'Get screens (can filter by propertyId)' })
  findAllScreens(@Query() pageOptionsDto: ScreenPageOptionsDto) {
    return this.inventoryService.findAllScreens(
      pageOptionsDto,
      pageOptionsDto.propertyId,
    );
  }

  @Get('screens/list')
  @Roles(Role.SUPER_ADMIN, Role.ADVERTISER)
  @ApiOperation({ summary: 'Get lightweight screen list for dropdowns' })
  findScreensList(@Query('propertyId') propertyId?: string) {
    return this.inventoryService.findScreensList(
      propertyId ? +propertyId : undefined,
    );
  }

  @Get('screens/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADVERTISER, Role.PROPERTY_OPERATOR)
  @ApiOperation({ summary: 'Get screen details' })
  findScreenById(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.findScreenById(id);
  }

  @Patch('screens/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update screen configuration' })
  updateScreen(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateScreenDto: UpdateScreenDto,
  ) {
    return this.inventoryService.updateScreen(id, updateScreenDto);
  }

  @Delete('screens/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete screen' })
  removeScreen(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.removeScreen(id);
  }

  @Post('rate-cards')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create new pricing rule (Admin Only)' })
  createRateCard(@Body() dto: CreateRateCardDto) {
    return this.inventoryService.createRateCard(dto);
  }

  @Get('rate-cards')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all active pricing rules' })
  findAllRateCards() {
    return this.inventoryService.findAllRateCards();
  }

  @Patch('rate-cards/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update pricing rule' })
  updateRateCard(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRateCardDto,
  ) {
    return this.inventoryService.updateRateCard(id, dto);
  }

  @Delete('rate-cards/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete pricing rule (Permanently)' })
  removeRateCard(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.removeRateCard(id);
  }
}
