import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaModule } from '../../providers/prisma/prisma.module';
import { UsersController } from './users.controller';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
