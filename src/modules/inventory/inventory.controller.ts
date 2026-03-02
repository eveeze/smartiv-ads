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
import { ApiStandardErrors } from '../../common/decorators/api-errors.decorator';
import {
  PropertyResponseDto,
  ScreenResponseDto,
  RateCardResponseDto,
  CategoryResponseDto,
  MessageResponseDto,
} from '../../common/dto/api-response.dto';
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
import { UpdateBlocklistDto } from './dto/blocklist.dto';

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
    type: [ScreenResponseDto],
  })
  @ApiStandardErrors({
    badRequest: 'Operator not assigned to any property.',
    notFound: false,
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
  @ApiOperation({
    summary: 'Create new property',
    description:
      'Registers a new hotel/hospital/building as a SmartIV Ads property.',
  })
  @ApiResponse({
    status: 201,
    description: 'Property created successfully.',
    type: PropertyResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Invalid property data or duplicate smartivCode.',
    notFound: false,
  })
  createProperty(@Body() createPropertyDto: CreatePropertyDto) {
    return this.inventoryService.createProperty(createPropertyDto);
  }

  @Get('properties')
  @Roles(Role.SUPER_ADMIN, Role.ADVERTISER)
  @ApiOperation({
    summary: 'Get all properties with pagination',
    description: 'Returns paginated list of all registered properties.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of properties.',
    type: [PropertyResponseDto],
  })
  @ApiStandardErrors({ badRequest: false, notFound: false })
  findAllProperties(@Query() pageOptionsDto: PageOptionsDto) {
    return this.inventoryService.findAllProperties(pageOptionsDto);
  }

  @Get('properties/list')
  @Roles(Role.SUPER_ADMIN, Role.ADVERTISER)
  @ApiOperation({
    summary: 'Get lightweight property list for dropdowns',
    description:
      'Returns ID + Name only. Ideal for select/dropdown components in frontend.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of {id, name} objects.',
    type: [PropertyResponseDto],
  })
  @ApiStandardErrors({ badRequest: false, notFound: false })
  findPropertiesList() {
    return this.inventoryService.findPropertiesList();
  }

  @Get('properties/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADVERTISER)
  @ApiOperation({
    summary: 'Get property details',
    description: 'Returns full property data including screens and blocklist.',
  })
  @ApiResponse({
    status: 200,
    description: 'Property detail object.',
    type: PropertyResponseDto,
  })
  @ApiStandardErrors({
    badRequest: false,
    notFound: 'Property with specified ID not found.',
  })
  findPropertyById(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.findPropertyById(id);
  }

  @Patch('properties/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update property',
    description:
      'Modifies property data (name, address, classification, etc.).',
  })
  @ApiResponse({
    status: 200,
    description: 'Property updated.',
    type: PropertyResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Invalid update data.',
    notFound: 'Property not found.',
  })
  updateProperty(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePropertyDto: UpdatePropertyDto,
  ) {
    return this.inventoryService.updateProperty(id, updatePropertyDto);
  }

  @Delete('properties/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Delete property',
    description:
      'Permanently removes a property and cascades to related screens.',
  })
  @ApiResponse({
    status: 200,
    description: 'Property deleted.',
    type: MessageResponseDto,
  })
  @ApiStandardErrors({ badRequest: false, notFound: 'Property not found.' })
  removeProperty(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.removeProperty(id);
  }

  @Post('screens')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Register new screen',
    description: 'Adds a new TV/display screen to an existing property.',
  })
  @ApiResponse({
    status: 201,
    description: 'Screen registered successfully.',
    type: ScreenResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Invalid screen data or duplicate code.',
    notFound: 'Referenced property not found.',
  })
  createScreen(@Body() createScreenDto: CreateScreenDto) {
    return this.inventoryService.createScreen(createScreenDto);
  }

  @Get('screens')
  @Roles(Role.SUPER_ADMIN, Role.ADVERTISER)
  @ApiOperation({
    summary: 'Get screens (can filter by propertyId)',
    description:
      'Returns paginated list of screens. Filter by propertyId query param.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of screens.',
    type: [ScreenResponseDto],
  })
  @ApiStandardErrors({ badRequest: false, notFound: false })
  findAllScreens(@Query() pageOptionsDto: ScreenPageOptionsDto) {
    return this.inventoryService.findAllScreens(
      pageOptionsDto,
      pageOptionsDto.propertyId,
    );
  }

  @Get('screens/list')
  @Roles(Role.SUPER_ADMIN, Role.ADVERTISER)
  @ApiOperation({
    summary: 'Get lightweight screen list for dropdowns',
    description:
      'Returns ID + Code + PropertyName only. Ideal for select/dropdown components.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of lightweight screen objects.',
    type: [ScreenResponseDto],
  })
  @ApiStandardErrors({ badRequest: false, notFound: false })
  findScreensList(@Query('propertyId') propertyId?: string) {
    return this.inventoryService.findScreensList(
      propertyId ? +propertyId : undefined,
    );
  }

  @Get('screens/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADVERTISER, Role.PROPERTY_OPERATOR)
  @ApiOperation({
    summary: 'Get screen details',
    description:
      'Returns full screen data including property info and connected campaigns.',
  })
  @ApiResponse({
    status: 200,
    description: 'Screen detail object.',
    type: ScreenResponseDto,
  })
  @ApiStandardErrors({
    badRequest: false,
    notFound: 'Screen with specified ID not found.',
  })
  findScreenById(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.findScreenById(id);
  }

  @Patch('screens/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update screen configuration',
    description: 'Modifies screen data (orientation, status, placement, etc.).',
  })
  @ApiResponse({
    status: 200,
    description: 'Screen updated.',
    type: ScreenResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Invalid update data.',
    notFound: 'Screen not found.',
  })
  updateScreen(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateScreenDto: UpdateScreenDto,
  ) {
    return this.inventoryService.updateScreen(id, updateScreenDto);
  }

  @Delete('screens/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Delete screen',
    description: 'Permanently removes a screen.',
  })
  @ApiResponse({
    status: 200,
    description: 'Screen deleted.',
    type: MessageResponseDto,
  })
  @ApiStandardErrors({ badRequest: false, notFound: 'Screen not found.' })
  removeScreen(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.removeScreen(id);
  }

  @Post('rate-cards')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create new pricing rule (Admin Only)',
    description:
      'Creates a rate card defining CPM pricing per slot, duration, and property.',
  })
  @ApiResponse({
    status: 201,
    description: 'Rate card created.',
    type: RateCardResponseDto,
  })
  @ApiStandardErrors({
    badRequest:
      'Conflicting rate card already exists for this slot/property/duration.',
    notFound: false,
  })
  createRateCard(@Body() dto: CreateRateCardDto) {
    return this.inventoryService.createRateCard(dto);
  }

  @Get('rate-cards')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List all active pricing rules',
    description: 'Returns all rate cards with property and slot information.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of rate card objects.',
    type: [RateCardResponseDto],
  })
  @ApiStandardErrors({ badRequest: false, notFound: false })
  findAllRateCards() {
    return this.inventoryService.findAllRateCards();
  }

  @Patch('rate-cards/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update pricing rule',
    description: 'Modifies an existing rate card.',
  })
  @ApiResponse({
    status: 200,
    description: 'Rate card updated.',
    type: RateCardResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Invalid update data.',
    notFound: 'Rate card not found.',
  })
  updateRateCard(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRateCardDto,
  ) {
    return this.inventoryService.updateRateCard(id, dto);
  }

  @Delete('rate-cards/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Delete pricing rule (Permanently)',
    description:
      'Removes pricing rule. Active campaigns referencing this card are not affected.',
  })
  @ApiResponse({
    status: 200,
    description: 'Rate card deleted.',
    type: MessageResponseDto,
  })
  @ApiStandardErrors({ badRequest: false, notFound: 'Rate card not found.' })
  removeRateCard(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.removeRateCard(id);
  }

  // ==========================================
  // PHASE 12: BRAND SAFETY BLOCKLIST
  // ==========================================

  @Get('categories')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List all industry categories',
    description:
      'Returns all available content categories (TRAVEL, F&B, ALCOHOL, etc.) for campaign tagging and blocklist management.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of industry category objects.',
    type: [CategoryResponseDto],
  })
  @ApiStandardErrors({ badRequest: false, notFound: false })
  findAllCategories() {
    return this.inventoryService.findAllCategories();
  }

  @Get('properties/:id/blocklist')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_OPERATOR)
  @ApiOperation({
    summary: 'Get blocked categories for a property',
    description:
      'Returns the list of industry categories that are blocked from advertising on this property.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of blocked category objects.',
    type: [CategoryResponseDto],
  })
  @ApiStandardErrors({ badRequest: false, notFound: 'Property not found.' })
  getBlocklist(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.getBlocklist(id);
  }

  @Post('properties/:id/blocklist')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update blocked categories for a property',
    description:
      'Sets the blocklist for a property. Pass an array of category IDs to block.',
  })
  @ApiResponse({
    status: 200,
    description: 'Blocklist updated successfully.',
    type: MessageResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Invalid category IDs.',
    notFound: 'Property not found.',
  })
  updateBlocklist(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBlocklistDto,
  ) {
    return this.inventoryService.updateBlocklist(id, dto);
  }

  @Get('properties/:id/availability')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_OPERATOR)
  @ApiOperation({
    summary: 'Check campaign availability (with blocklist filtering)',
    description:
      'Returns available campaigns for a property, automatically filtering out blocked categories.',
  })
  @ApiResponse({
    status: 200,
    description: 'Filtered availability data.',
    type: Object,
  })
  @ApiStandardErrors({ badRequest: false, notFound: 'Property not found.' })
  checkAvailability(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.checkAvailability(id);
  }
}
