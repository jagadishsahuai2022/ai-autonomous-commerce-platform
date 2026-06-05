import { Controller, Get, Header, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { AppService } from './app.service';
import { MetricsService } from './common/services/metrics.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly metricsService: MetricsService
  ) {}

  @Get('/health')
  health() {
    return this.appService.getHealth();
  }

  @Get('/metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(@Res() res: FastifyReply): Promise<void> {
    const output = await this.metricsService.getMetrics();
    res.send(output);
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
