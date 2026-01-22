# Order Management System

This document describes the order processing endpoints developed for the MarketX-backend application.

## Overview
The order management system handles order creation, status tracking, and order history for buyers and sellers. It includes business logic for state transitions and order cancellation rules.

## Features

### Order States
- `pending`: Initial state when an order is created
- `paid`: After payment has been processed
- `shipped`: When the order has been shipped
- `delivered`: When the order has been delivered
- `cancelled`: When the order has been cancelled

### Endpoints

#### POST `/orders`
Creates a new order with the provided items and buyer information.

Request body:
```json
{
  "items": [
    {
      "productId": "string",
      "quantity": "number"
    }
  ],
  "buyerId": "string"
}
```

Response:
```json
{
  "id": "string",
  "totalAmount": "number",
  "status": "string",
  "trackingNumber": "string",
  "items": [
    {
      "productId": "string",
      "productName": "string",
      "quantity": "number",
      "price": "number",
      "subtotal": "number"
    }
  ],
  "buyerId": "string",
  "createdAt": "date",
  "updatedAt": "date",
  "cancelledAt": "date",
  "shippedAt": "date",
  "deliveredAt": "date"
}
```

#### GET `/orders`
Retrieves all orders, or orders for a specific buyer if the `buyerId` query parameter is provided.

#### GET `/orders/:id`
Retrieves a specific order by its ID.

#### PATCH `/orders/:id/status`
Updates the status of an order. Validates state transitions according to business rules.

Request body:
```json
{
  "status": "pending|paid|shipped|delivered|cancelled"
}
```

#### PATCH `/orders/:id/cancel`
Cancels an order with business rule validation.

Request body:
```json
{
  "userId": "string"
}
```

## Business Rules

### State Transitions
Valid state transitions are enforced:
- `pending` → `paid` or `cancelled`
- `paid` → `shipped` or `cancelled`
- `shipped` → `delivered` or `cancelled`
- `delivered` → no further transitions
- `cancelled` → no further transitions

### Cancellation Rules
- Only `pending` or `paid` orders can be cancelled
- Only the buyer can cancel their own order

## Events
The system emits events for important state changes:
- `OrderCreated`: When a new order is created
- `OrderStatusChanged`: When an order status is updated
- `OrderCancelled`: When an order is cancelled

## Implementation Details

### Entities
- `Order` entity with TypeORM decorators
- UUID primary key generation
- JSON column for storing order items
- Timestamps for all state changes

### Services
- `OrdersService` with repository pattern for database operations
- State machine validation for transitions
- Business rule enforcement

### DTOs
- `CreateOrderDto` for order creation requests
- `UpdateOrderStatusDto` for status updates
- `OrderResponseDto` for API responses

## Database
The system uses TypeORM with SQLite for persistence, configured with automatic synchronization in development mode.

## Testing
Unit tests are included for the service layer, testing all business logic and state transitions.