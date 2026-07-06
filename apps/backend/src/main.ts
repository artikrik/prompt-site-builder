import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

function resolveAllowedOrigins(frontendUrl: string): string[] {
  const origins = [frontendUrl];

  // Auto-add www variant for production domains
  try {
    const url = new URL(frontendUrl);
    if (url.hostname.startsWith('www.')) {
      origins.push(frontendUrl.replace('www.', ''));
    } else if (url.hostname !== 'localhost') {
      origins.push(frontendUrl.replace('://', '://www.'));
    }
  } catch {
    // If URL parsing fails, just use the original value
  }

  // Allow localhost dev ports
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
  app.enableCors({
    origin: resolveAllowedOrigins(frontendUrl),
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
