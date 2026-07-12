import { Module } from '@nestjs/common';
import { AddonService } from './addon.service';
import { AddonInjectorService } from './addon-injector.service';
import { AddonController } from './addon.controller';
import { PrismaModule } from '../../shared/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AddonController],
  providers: [AddonService, AddonInjectorService],
  exports: [AddonService, AddonInjectorService],
})
export class AddonModule {}
