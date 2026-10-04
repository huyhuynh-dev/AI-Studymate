import { Injectable, OnApplicationShutdown, OnModuleInit, Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { ConfigService } from '@nestjs/config';


@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
    private client: RedisClientType;
    private readonly logger = new Logger(RedisService.name);

    constructor(private readonly configService: ConfigService) {
        this.client = createClient({
            url: this.configService.getOrThrow<string>('REDIS_URL'),
            password: this.configService.getOrThrow<string>('REDIS_PASSWORD')
        });

        this.client.on('error', (error) => {
            this.logger.error('Redis client error:', error);
        });
    };

    async onModuleInit() {
        if (!this.client.isOpen) {
            await this.client.connect();
        }
    }

    async onApplicationShutdown(signal?: string) {
        if (this.client.isOpen) {
            await this.client.quit();
        }
    }

    async get(key: string): Promise<string | null> {
        return await this.client.get(key);
    }

    async set(key: string, value: string, expirationInSeconds?: number): Promise<void> {
        if (expirationInSeconds) {
            await this.client.set(key, value, { EX: expirationInSeconds });
        } else {
            await this.client.set(key, value);
        }
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }

    async getAndDelete(key: string): Promise<string | null> {
        return await this.client.getDel(key);
    }

    // SEC-06: Atomic increment — tránh race condition trong OTP attempt counting
    async incr(key: string): Promise<number> {
        return await this.client.incr(key);
    }

    // Đặt TTL cho key (dùng sau INCR vì INCR không set TTL)
    async expire(key: string, seconds: number): Promise<void> {
        await this.client.expire(key, seconds);
    }

    getRedisClient(): RedisClientType {
        return this.client;
    }
}
