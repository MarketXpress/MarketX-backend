import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { TestWebhookDto } from './dto/test-webhook.dto';
import { Webhook, WebhookEventType } from './entities/webhook.entity';

// Assuming you have an auth guard
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('webhooks')
@Controller('webhooks')
// @UseGuards(JwtAuthGuard)
// @ApiBearerAuth()
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new webhook' })
  @ApiResponse({ status: 201, description: 'Webhook created successfully', type: Webhook })
  async create(@Body() createWebhookDto: CreateWebhookDto): Promise<Webhook> {
    return await this.webhooksService.create(createWebhookDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all webhooks' })
  @ApiResponse({ status: 200, description: 'List of webhooks', type: [Webhook] })
  async findAll(): Promise<Webhook[]> {
    return await this.webhooksService.findAll();
  }

  @Get('events')
  @ApiOperation({ summary: 'Get available webhook event types' })
  @ApiResponse({ status: 200, description: 'List of available event types' })
  getEventTypes(): { eventTypes: WebhookEventType[] } {
    return {
      eventTypes: Object.values(WebhookEventType),
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get webhook delivery queue statistics' })
  @ApiResponse({ status: 200, description: 'Queue statistics' })
  getStats() {
    return this.webhooksService.getQueueStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get webhook by ID' })
  @ApiResponse({ status: 200, description: 'Webhook details', type: Webhook })
  async findOne(@Param('id') id: string): Promise<Webhook> {
    return await this.webhooksService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update webhook' })
  @ApiResponse({ status: 200, description: 'Webhook updated successfully', type: Webhook })
  async update(
    @Param('id') id: string,
    @Body() updateWebhookDto: UpdateWebhookDto,
  ): Promise<Webhook> {
    return await this.webhooksService.update(id, updateWebhookDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete webhook' })
  @ApiResponse({ status: 204, description: 'Webhook deleted successfully' })
  async remove(@Param('id') id: string): Promise<void> {
    return await this.webhooksService.remove(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test webhook delivery' })
  @ApiResponse({ status: 200, description: 'Test delivery result' })
  async testWebhook(
    @Param('id') id: string,
    @Body() testWebhookDto: TestWebhookDto,
  ) {
    return await this.webhooksService.testWebhook(
      id,
      testWebhookDto.eventType,
      testWebhookDto.payload,
    );
  }

  @Get('delivery/:deliveryId')
  @ApiOperation({ summary: 'Get delivery status' })
  @ApiResponse({ status: 200, description: 'Delivery status' })
  getDeliveryStatus(@Param('deliveryId') deliveryId: string) {
    const delivery = this.webhooksService.getDeliveryStatus(deliveryId);
    if (!delivery) {
      return { error: 'Delivery not found' };
    }
    return delivery;
  }
}