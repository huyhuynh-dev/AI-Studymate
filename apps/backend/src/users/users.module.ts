import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { RepoModule } from '../repo/repo.module.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [RepoModule, StorageModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
