import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardErrors } from '../../common/decorators/api-errors.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { Roles } from '../../common/decorators/roles/roles.decorator';
import { Role } from '@prisma/client';
import type { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserPageOptionsDto } from './dto/user-page-options.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { AssignPropertyDto } from './dto/assign-property.dto';
import { PageDto } from '../../common/dto/page.dto';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('Users Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Phase 8.5 Endpoints

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create new user (Admin Onboarding)',
    description:
      'Admin creates a new user with a specified role. Used for onboarding operators and other staff.',
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully.',
    type: UserResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Invalid data or email already exists.',
    notFound: false,
  })
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.usersService.createUser(createUserDto);
    return new UserResponseDto(user);
  }

  @Patch(':id/assign-property')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Assign Property to Operator',
    description:
      'Links a user (Operator) to a specific property for management purposes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Property assigned.',
    type: UserResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Invalid property or user ID.',
    notFound: 'User or property not found.',
  })
  async assignProperty(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPropertyDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.assignProperty(id, dto);
    return new UserResponseDto(user);
  }

  // Phase 8 Endpoints

  @Patch('profile')
  @ApiOperation({
    summary: 'Update my profile',
    description:
      'Allows the currently logged-in user to update their own profile (name, phone, etc.).',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiStandardErrors({
    badRequest: 'Invalid profile data.',
    forbidden: false,
    notFound: false,
  })
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
  @ApiOperation({
    summary: 'Get All Users',
    description:
      'Returns a paginated list of all users. Supports filtering by role and search by name/email.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of users.',
    type: PageDto,
  })
  @ApiStandardErrors({ badRequest: false, notFound: false })
  async findAll(@Query() pageOptionsDto: UserPageOptionsDto) {
    return this.usersService.findAll(pageOptionsDto);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get User Detail',
    description: 'Returns the full profile of a specific user by their ID.',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiStandardErrors({
    badRequest: false,
    notFound: 'User with specified ID not found.',
  })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UserResponseDto> {
    const result = await this.usersService.findOne(id);
    return new UserResponseDto(result);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Block/Unblock user',
    description:
      'Toggles a user active/inactive status. Blocked users cannot log in.',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiStandardErrors({
    badRequest: 'Invalid status value.',
    notFound: 'User not found.',
  })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<UserResponseDto> {
    const result = await this.usersService.updateStatus(id, dto);
    return new UserResponseDto(result);
  }
}
