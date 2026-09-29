import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, User } from '../../../prisma/src/generated/prisma/client.js';

@Injectable()
export class UsersRepoService {
    constructor(private readonly prisma: PrismaService) { };

    async createUser(data: Prisma.UserCreateInput): Promise<User> {
        return this.prisma.user.create({ data });
    }

    async findUserByEmail(email: string): Promise<User | null> {
        return await this.prisma.user.findUnique({
            where: {
                email
            }
        })
    }

    async findUserById(id: string): Promise<User | null> {
        return await this.prisma.user.findUnique({
            where: {
                id
            }
        })
    };
}
