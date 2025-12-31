import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Patch,
  Body,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { Roles } from '../../common/decorators/roles/roles.decorator';
// [FIX] Pisahkan import 'User' sebagai type, dan 'Role' sebagai value
import { Role } from '@prisma/client';
import type { User } from '@prisma/client';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { CurrentUser } from '../../common/decorators/current-user/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Users Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard) // Guard default aktif untuk semua endpoint
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ==========================================
  // SELF SERVICE (ADVERTISER & ADMIN)
  // ==========================================

  // [NEW] Update Profile (Harus diletakkan DI ATAS route :id)
  @Patch('profile')
  @ApiOperation({ summary: 'Update my profile (Name & Phone only)' })
  updateProfile(
    @CurrentUser() user: User,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, updateProfileDto);
  }

  // ==========================================
  // ADMIN ONLY
  // ==========================================

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get All Users (Advertisers/Admins)' })
  findAll(@Query() pageOptionsDto: PageOptionsDto) {
    return this.usersService.findAll(pageOptionsDto);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get User Detail & Stats' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }
}
