import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Patch,
  Body,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { Roles } from '../../common/decorators/roles/roles.decorator';
import { Role } from '@prisma/client';
import type { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserPageOptionsDto } from './dto/user-page-options.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { PageDto } from '../../common/dto/page.dto';
import { UserResponseDto } from './dto/user-response.dto'; // [NEW]

@ApiTags('Users Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor) // [BEST PRACTICE] Aktifkan Serialization
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('profile')
  @ApiOperation({ summary: 'Update my profile' })
  @ApiResponse({ type: UserResponseDto }) // Doc Swagger update
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const result = await this.usersService.updateProfile(user.id, dto);
    return new UserResponseDto(result);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get All Users' })
  @ApiResponse({ status: 200, type: PageDto })
  async findAll(@Query() pageOptionsDto: UserPageOptionsDto) {
    return this.usersService.findAll(pageOptionsDto);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get User Detail' })
  @ApiResponse({ type: UserResponseDto })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UserResponseDto> {
    const result = await this.usersService.findOne(id);
    return new UserResponseDto(result); // Transform ke DTO aman
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Block/Unblock user' })
  @ApiResponse({ type: UserResponseDto })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<UserResponseDto> {
    const result = await this.usersService.updateStatus(id, dto);
    return new UserResponseDto(result);
  }
}
