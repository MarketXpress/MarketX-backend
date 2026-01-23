import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryChangeType } from './inventory-history.entity';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get(':listingId')
  async getInventory(@Param('listingId') listingId: string) {
    return this.inventoryService.getInventory(listingId);
  }

  @Get(':listingId/history')
  async getInventoryHistory(@Param('listingId') listingId: string) {
    return this.inventoryService.getInventoryHistory(listingId);
  }

  @Post('adjust')
  async adjustInventory(@Body() body: { listingId: string; userId: string; change: number; note?: string }) {
    return this.inventoryService.adjustInventory(body.listingId, body.userId, body.change, InventoryChangeType.ADJUSTMENT, body.note);
  }

  @Post('reserve')
  async reserveInventory(@Body() body: { listingId: string; userId: string; amount: number }) {
    return this.inventoryService.reserveInventory(body.listingId, body.userId, body.amount);
  }

  @Post('release')
  async releaseInventory(@Body() body: { listingId: string; userId: string; amount: number }) {
    return this.inventoryService.releaseInventory(body.listingId, body.userId, body.amount);
  }

  @Post('bulk-update')
  async bulkUpdateInventory(@Body() body: { updates: { listingId: string; userId: string; change: number; note?: string }[] }) {
    return this.inventoryService.bulkUpdateInventory(body.updates);
  }
} 