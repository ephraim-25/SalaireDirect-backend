import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

/** CORS_ORIGIN accepte une ou plusieurs origines séparées par des virgules. */
function allowedOrigins(): string[] {
  const configured = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (configured.length > 0) return configured;

  // Sans configuration : frontend de production + développement local (jamais « * »).
  return [
    'https://salaire-direct-frontend.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ];
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  // Render est derrière un proxy : nécessaire pour que la limitation de débit voie la vraie IP client.
  app.set('trust proxy', 1);
  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const origins = allowedOrigins();
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(
    `API SalaireDirect démarrée sur le port ${port} (préfixe /api/v1)`,
  );
  logger.log(`Origines CORS autorisées : ${origins.join(', ')}`);
}

bootstrap();
