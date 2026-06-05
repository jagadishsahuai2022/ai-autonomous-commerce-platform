import { Module } from '@nestjs/common';
import { MobileDevicesController } from './mobile-devices.controller';

@Module({ controllers: [MobileDevicesController] })
export class MobileDevicesModule {}
