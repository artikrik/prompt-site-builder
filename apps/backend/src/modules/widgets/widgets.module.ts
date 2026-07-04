import { Module } from '@nestjs/common';
import { WidgetsService } from './widgets.service';
import { WidgetsController } from './widgets.controller';
import { WidgetApiController } from './widget-api.controller';
import { BookingWidgetService } from './booking-widget.service';
import { PaymentWidgetService } from './payment-widget.service';

@Module({
  controllers: [WidgetsController, WidgetApiController],
  providers: [WidgetsService, BookingWidgetService, PaymentWidgetService],
  exports: [WidgetsService, BookingWidgetService, PaymentWidgetService],
})
export class WidgetsModule {}
