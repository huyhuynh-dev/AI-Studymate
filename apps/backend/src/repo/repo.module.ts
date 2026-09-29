import { Module } from '@nestjs/common';
import { UsersRepoService } from './users-repo/users-repo.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [UsersRepoService],
  exports: [UsersRepoService],
})
export class RepoModule { }
