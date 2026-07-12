import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';
import express from 'express';
import { AppModule } from './app.module';

/**
 * Build the list of allowed CORS origins from explicit config + static dev ports.
 */
function resolveAllowedOrigins(frontendUrl: string, baseDomain: string): string[] {
  const origins: string[] = [];

  const isProduction = process.env.NODE_ENV === 'production';
  const isDefaultLocalhost = frontendUrl.includes('localhost');

  if (isProduction && isDefaultLocalhost && baseDomain) {
    origins.push(`https://${baseDomain}`, `https://www.${baseDomain}`);
  } else {
    origins.push(frontendUrl);
  }

  // Auto-add www / non-www variant for non-localhost domains
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

/**
 * Derive the frontend base domain from the API's own hostname.
 *   api.sitenow.pp.ua  →  sitenow.pp.ua
 *   api.staging.example.com  →  staging.example.com
 * Falls back to BASE_DOMAIN env var if hostname doesn't follow the api.* pattern.
 */
function deriveBaseDomainFromHost(apiHost: string, configBaseDomain: string): string | null {
  // apiHost looks like "api.sitenow.pp.ua" or "api.sitenow.pp.ua:3000"
  const hostname = apiHost.split(':')[0];
  if (hostname.startsWith('api.')) {
    return hostname.slice(4); // strip "api." prefix
  }
  return configBaseDomain || null;
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

  // Dynamic CORS middleware — derives allowed origins per-request from the API's
  // own hostname so CORS works even when neither FRONTEND_URL nor BASE_DOMAIN are
  // explicitly set in the production .env file.
  app.use((req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    // Build allowed origins: explicit config + host-derived
    const allowed = resolveAllowedOrigins(frontendUrl, baseDomain);
    const apiHost = req.headers.host;
    if (apiHost) {
      const derived = deriveBaseDomainFromHost(apiHost, baseDomain);
      if (derived) {
        allowed.push(`https://${derived}`, `https://www.${derived}`);
      }
    }

    // Deduplicate
    const uniqueAllowed = [...new Set(allowed)];

    if (origin && uniqueAllowed.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (!origin) {
      // Non-browser requests (curl, server-to-server) — no origin header
      // Let them through without ACAO so they work but can't be exploited by browsers
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
      const requestMethod = req.headers['access-control-request-method'];
      if (requestMethod) {
        res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type,Authorization');
        res.setHeader('Access-Control-Max-Age', '86400');
      }
      if (origin && uniqueAllowed.includes(origin)) {
        res.status(204).end();
        return;
      }
    }

    next();
  });

  const config = new DocumentBuilder()
    .setTitle('Prompt Site Builder API')
    .setDescription('AI-powered B2B site generation platform')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Serve variant preview assets (CSS, JS, images) from Hugo sites directory
  const hugoSitesPath = configService.get<string>('HUGO_SITES_PATH') || '/var/www/client-sites';
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use('/variant-preview', express.static(hugoSitesPath));

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`Variant preview static serve: ${hugoSitesPath}`);
  logger.log(`Application running on: http://localhost:${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
