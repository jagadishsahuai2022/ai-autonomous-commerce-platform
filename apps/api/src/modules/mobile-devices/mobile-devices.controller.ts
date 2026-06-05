import { Body, Controller, Delete, HttpCode, HttpStatus, Logger, Param, Post } from '@nestjs/common';

/**
 * Device registry for push notifications.
 * MVP: in-memory only. TODO: persist to Postgres + index by userId.
 */
interface Device {
  id: string;
  userId?: number;
  expoPushToken: string;
  platform: 'ios' | 'android';
  registeredAt: number;
}

@Controller('devices')
export class MobileDevicesController {
  private readonly logger = new Logger(MobileDevicesController.name);
  private readonly devices = new Map<string, Device>();

  /**
   * POST /devices/register
   * Body: { expoPushToken, platform, userId? }
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() body: { expoPushToken: string; platform: 'ios' | 'android'; userId?: number }) {
    const id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const device: Device = { id, ...body, registeredAt: Date.now() };
    this.devices.set(id, device);
    this.logger.log(`Registered device ${id} for user ${body.userId ?? 'anon'}`);
    return device;
  }

  /**
   * DELETE /devices/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  unregister(@Param('id') id: string) {
    this.devices.delete(id);
  }
}
