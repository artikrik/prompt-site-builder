import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

function resolveAllowedOrigins(frontendUrl: string, baseDomain: string): string[] {
  const origins: string[] = [];

  // When FRONTEND_URL is still the localhost default but we're in production,
  // derive the real production URL from BASE_DOMAIN.
  const isProduction = process.env.NODE_ENV === 'production';
  const isDefaultLocalhost = frontendUrl.includes('localhost');

  if (isProduction && isDefaultLocalhost && baseDomain) {
    origins.push(`https://${baseDomain}`, `https://www.${baseDomain}`);
  } else {
    origins.push(frontendUrl);
  }

  // Auto-add www variant for non-localhost domains (if not already added above)
  try {
    const url = new URL(origins[0]);
    if (url.hostname.startsWith('www.')) {
      const withoutWww = origins[0].replace('www.', '');
      if (!origins.includes(withoutWww)) origins.push(withoutWww);
    } else if (url.hostname !== 'localhost') {
      const withWww = origins[0].replace('://', '://www.');
      if (!origins.includes(withWww)) origins.push(withWww);
    }
  } catch {
    // If URL parsing fails, keep what we have
  }

  // Always allow localhost dev ports
  origins.push('http://localhost:5173', 'http://localhost:5174');

  return [...new Set(origins)];
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const frontendUrl = configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
  const baseDomain = configService.get<string>('BASE_DOMAIN') || '';
  app.enableCors({
    origin: resolveAllowedOrigins(frontendUrl, baseDomain),
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Prompt Site Builder API')
    .setDescription('AI-powered B2B site generation platform')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`Application running on: http://localhost:${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
