import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { validateEnv } from './shared/config/env.validation';
import { RolesGuard } from './shared/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { LeadsModule } from './modules/leads/leads.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { GenerationModule } from './modules/generation/generation.module';
import { PublishingModule } from './modules/publishing/publishing.module';
import { WidgetsModule } from './modules/widgets/widgets.module';
import { ScrapingModule } from './modules/scraping/scraping.module';
import { EnrichmentModule } from './modules/enrichment/enrichment.module';
import { QueueModule } from './modules/queue/queue.module';
import { HealthModule } from './modules/health/health.module';
import { SettingsModule } from './modules/settings/settings.module';
import { PrismaModule } from './shared/prisma/prisma.module';
import { RedisModule } from './shared/redis/redis.module';

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 20,
    }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    QueueModule,
    AuthModule,
    LeadsModule,
    ProjectsModule,
    GenerationModule,
    PublishingModule,
    WidgetsModule,
    ScrapingModule,
    EnrichmentModule,
    HealthModule,
    SettingsModule,
  ],
})
export class AppModule {}
