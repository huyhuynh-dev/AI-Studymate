import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, User } from '../../generated/prisma/client.js';

@Injectable()
export class UsersRepoService {
    constructor(private readonly prisma: PrismaService) { };

    async createUser(user: Prisma.UserCreateInput): Promise<User> {
        return this.prisma.user.create({ data: user });
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

    async updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
        return this.prisma.user.update({
            where: { id },
            data,
        });
    }
}
