import { Module } from '@nestjs/common';
import { SubjectsController } from './subjects.controller.js';
import { SubjectsService } from './subjects.service.js';
import { SubjectsRepoService } from '../repo/subjects-repo/subjects-repo.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  controllers: [SubjectsController],
  providers: [SubjectsService, SubjectsRepoService],
  imports: [PrismaModule],
})
export class SubjectsModule { }
