import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { Roles } from '../../common/decorators/roles/roles.decorator';
import { Role } from '@prisma/client';
import { PageOptionsDto } from '../../common/dto/page-options.dto';

@ApiTags('Users Management (Admin Only)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get All Users (Advertisers/Admins)' })
  findAll(@Query() pageOptionsDto: PageOptionsDto) {
    return this.usersService.findAll(pageOptionsDto);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get User Detail & Stats' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }
}
