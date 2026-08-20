import {
  Controller,
  Get,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as promClient from 'prom-client';

@Controller()
export class MetricsController {
  @Get('/metrics')
  async metrics(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const configuredToken = process.env.METRICS_TOKEN;

    if (!configuredToken) {
      throw new UnauthorizedException('Metrics endpoint is not configured');
    }

    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Metrics authentication required');
    }

    const token = authorization.slice('Bearer '.length).trim();

    if (token !== configuredToken) {
      throw new UnauthorizedException('Invalid metrics credentials');
    }

    response
      .setHeader('Content-Type', promClient.register.contentType)
      .send(await promClient.register.metrics());
  }
}
