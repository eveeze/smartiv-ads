import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateScreenDto } from './dto/create-screen.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { UpdateScreenDto } from './dto/update-screen.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { Roles } from '../../common/decorators/roles/roles.decorator';
import { Role } from '@prisma/client';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { ScreenPageOptionsDto } from './dto/screen-page-options.dto';

@ApiTags('Inventory (Properties & Screens)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // --- PROPERTIES ---

  @Post('properties')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new Property (Hotel/Building)' })
  createProperty(@Body() createPropertyDto: CreatePropertyDto) {
    return this.inventoryService.createProperty(createPropertyDto);
  }

  @Get('properties')
  @Roles(Role.SUPER_ADMIN, Role.ADVERTISER)
  @ApiOperation({ summary: 'Get Paginated List of Properties' })
  findAllProperties(@Query() pageOptionsDto: PageOptionsDto) {
    return this.inventoryService.findAllProperties(pageOptionsDto);
  }

  // [NEW] Harus diatas :id agar tidak tertangkap sebagai parameter ID
  @Get('properties/list')
  @Roles(Role.SUPER_ADMIN, Role.ADVERTISER)
  @ApiOperation({
    summary: 'Get Lightweight Property List (For Dropdowns)',
    description: 'Returns minimal data (ID, Name, City) without pagination.',
  })
  getPropertiesList() {
    return this.inventoryService.getPropertiesList();
  }

  @Get('properties/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADVERTISER)
  @ApiOperation({ summary: 'Get Property Detail' })
  findOneProperty(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.findOneProperty(id);
  }

  @Patch('properties/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update Property' })
  updateProperty(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePropertyDto: UpdatePropertyDto,
  ) {
    return this.inventoryService.updateProperty(id, updatePropertyDto);
  }

  @Delete('properties/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete Property' })
  removeProperty(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.removeProperty(id);
  }

  // --- SCREENS ---

  @Post('screens')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Register a new Screen/TV' })
  createScreen(@Body() createScreenDto: CreateScreenDto) {
    return this.inventoryService.createScreen(createScreenDto);
  }

  @Get('screens')
  @Roles(Role.SUPER_ADMIN, Role.ADVERTISER)
  @ApiOperation({ summary: 'Get Paginated List of Screens' })
  findAllScreens(@Query() pageOptionsDto: ScreenPageOptionsDto) {
    return this.inventoryService.findAllScreens(pageOptionsDto);
  }

  // [NEW] Harus diatas :id
  @Get('screens/list')
  @Roles(Role.SUPER_ADMIN, Role.ADVERTISER)
  @ApiOperation({
    summary: 'Get Lightweight Screen List (For Dropdowns)',
    description: 'Filterable by propertyId. Returns ID, Name, Code.',
  })
  @ApiQuery({ name: 'propertyId', required: false, type: Number })
  getScreensList(
    @Query('propertyId', new ParseIntPipe({ optional: true }))
    propertyId?: number,
  ) {
    return this.inventoryService.getScreensList(propertyId);
  }

  @Get('screens/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADVERTISER)
  @ApiOperation({ summary: 'Get Screen Detail' })
  findOneScreen(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.findOneScreen(id);
  }

  @Patch('screens/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update Screen' })
  updateScreen(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateScreenDto: UpdateScreenDto,
  ) {
    return this.inventoryService.updateScreen(id, updateScreenDto);
  }

  @Delete('screens/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete Screen' })
  removeScreen(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.removeScreen(id);
  }
}
