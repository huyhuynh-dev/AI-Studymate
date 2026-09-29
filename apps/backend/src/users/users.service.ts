import { Injectable } from '@nestjs/common';
import { UsersRepoService } from '../repo/users-repo/users-repo.service.js';
import { Prisma, User } from '../../prisma/src/generated/prisma/client.js';
import { RegisterDto } from '../auth/dto/register.dto.js';

@Injectable()
export class UsersService {
    constructor(
        private readonly usersRepo: UsersRepoService,
    ) { };

    async createUser(data: Prisma.UserCreateInput): Promise<User | null> {
        return this.usersRepo.createUser(data);
    }

    async findUserByEmail(email: string): Promise<User | null> {
        return this.usersRepo.findUserByEmail(email);
    }

    async findUserById(id: string): Promise<User | null> {
        return this.usersRepo.findUserById(id);
    }
}
