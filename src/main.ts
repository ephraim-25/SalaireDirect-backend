import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validation globale des DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || ['https://salaire-direct-frontend.vercel.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Préfixe API global
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║      🚀 SalaireDirect Backend Started            ║
  ║      Supabase: szxgouaihkxuomfguxbz              ║
  ║      API: https://salairedirect-backend.onrender.com/api/v1          ║
  ╚══════════════════════════════════════════════════╝
  `);
}

bootstrap();
