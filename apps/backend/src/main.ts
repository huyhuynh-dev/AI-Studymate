import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { HttpLoggingFilter } from './common/filters/http-logging.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  // Mở rộng giới hạn body parser lên 25mb để hỗ trợ đồng bộ bản nháp DOCX SuperDoc và dữ liệu RAG
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true, // CQ-10: Trả 400 nếu client gửi field không có trong DTO
    transform: true,
  }));
  app.useGlobalFilters(new HttpLoggingFilter());


  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
