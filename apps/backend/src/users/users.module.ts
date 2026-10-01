import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { RepoModule } from '../repo/repo.module.js';

@Module({
  imports: [RepoModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule { }
