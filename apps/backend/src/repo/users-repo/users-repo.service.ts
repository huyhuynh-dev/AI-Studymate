import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, User } from '../../generated/prisma/client.js';

export interface UserProfileStats {
    subjects_count: number;
    conversations_count: number;
    documents_count: number;
    flashcard_decks_count: number;
    quizzes_count: number;
}

export interface UserProfileRecord {
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    role: string;
    is_active: boolean;
    is_verified: boolean;
    provider: string | null;
    has_password: boolean;
    created_at: Date;
    updated_at: Date;
    stats: UserProfileStats;
}

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

    async getUserProfileWithStats(userId: string): Promise<UserProfileRecord | null> {
        const row = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatar_url: true,
                role: true,
                is_active: true,
                is_verified: true,
                provider: true,
                password_hash: true,
                created_at: true,
                updated_at: true,
                _count: {
                    select: {
                        subjects: true,
                        conversations: true,
                        documents: true,
                        flashcard_decks: true,
                        quizzes: true,
                    },
                },
            },
        });

        if (!row) {
            return null;
        }

        return {
            id: row.id,
            email: row.email,
            name: row.name,
            avatar_url: row.avatar_url,
            role: row.role,
            is_active: row.is_active,
            is_verified: row.is_verified,
            provider: row.provider,
            has_password: Boolean(row.password_hash),
            created_at: row.created_at,
            updated_at: row.updated_at,
            stats: {
                subjects_count: row._count.subjects,
                conversations_count: row._count.conversations,
                documents_count: row._count.documents,
                flashcard_decks_count: row._count.flashcard_decks,
                quizzes_count: row._count.quizzes,
            },
        };
    }

    async collectUserStorageKeys(userId: string): Promise<string[]> {
        const [userRow, docs] = await Promise.all([
            this.prisma.user.findUnique({
                where: { id: userId },
                select: { avatar_url: true },
            }),
            this.prisma.document.findMany({
                where: { user_id: userId },
                select: { storage_key: true, docling_json_key: true },
            }),
        ]);

        const keys = new Set<string>();
        if (userRow?.avatar_url?.startsWith('avatars/')) {
            keys.add(userRow.avatar_url);
        }
        for (const doc of docs) {
            if (doc.storage_key) {
                keys.add(doc.storage_key);
            }
            if (doc.docling_json_key) {
                keys.add(doc.docling_json_key);
            }
        }
        return Array.from(keys);
    }

    async deleteUserById(userId: string): Promise<{ id: string }> {
        return this.prisma.user.delete({
            where: { id: userId },
            select: { id: true },
        });
    }
}
