import { Module } from '@nestjs/common';
import { GoogleService } from './google.service.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';

@Module({
  providers: [GoogleService, AuthService],
  controllers: [AuthController]
})
export class AuthModule {}
