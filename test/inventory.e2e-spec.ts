import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Listing } from '../src/listing/entities/listing.entity';
import { InventoryHistory } from '../src/inventory/inventory-history.entity';
import { User } from '../src/entities/user.entity';
import { Order } from '../src/orders/entities/order.entity';

describe('Inventory Management System (e2e)', () => {
  let app: INestApplication;
  let listingRepo: Repository<Listing>;
  let inventoryHistoryRepo: Repository<InventoryHistory>;
  let userRepo: Repository<User>;
  let orderRepo: Repository<Order>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get repositories
    listingRepo = app.get(getRepositoryToken(Listing));
    inventoryHistoryRepo = app.get(getRepositoryToken(InventoryHistory));
    userRepo = app.get(getRepositoryToken(User));
    orderRepo = app.get(getRepositoryToken(Order));

    // Clean up any existing test data
    await inventoryHistoryRepo.clear();
    await listingRepo.clear();
    await orderRepo.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Create a test user
    const testUser = userRepo.create({
      id: 'test-user-id',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      password: 'hashedPassword',
      isActive: true,
    });
    await userRepo.save(testUser);
  });

  it('/inventory/:listingId (GET) - Get inventory details', async () => {
    // Create a test listing
    const listing = await listingRepo.save(
      listingRepo.create({
        title: 'Test Product',
        description: 'A test product',
        price: 100,
        currency: 'USD',
        address: '123 Test St',
        quantity: 10,
        reserved: 2,
        available: 8,
        userId: 'test-user-id',
        location: 'POINT(-122.4194 37.7749)',
        shareLocation: true,
      })
    );

    return request(app.getHttpServer())
      .get(`/inventory/${listing.id}`)
      .expect(200)
      .then(response => {
        expect(response.body.quantity).toBe(10);
        expect(response.body.reserved).toBe(2);
        expect(response.body.available).toBe(8);
      });
  });

  it('/inventory/reserve (POST) - Reserve inventory', async () => {
    // Create a test listing
    const listing = await listingRepo.save(
      listingRepo.create({
        title: 'Test Product',
        description: 'A test product',
        price: 100,
        currency: 'USD',
        address: '123 Test St',
        quantity: 10,
        reserved: 0,
        available: 10,
        userId: 'test-user-id',
        location: 'POINT(-122.4194 37.7749)',
        shareLocation: true,
      })
    );

    const reserveDto = {
      listingId: listing.id,
      userId: 'test-user-id',
      amount: 3,
    };

    return request(app.getHttpServer())
      .post('/inventory/reserve')
      .send(reserveDto)
      .expect(201)
      .then(response => {
        expect(response.body.available).toBe(7); // 10 - 3 = 7
        expect(response.body.reserved).toBe(3);  // 0 + 3 = 3
      });
  });

  it('/inventory/release (POST) - Release inventory', async () => {
    // Create a test listing with some reserved items
    const listing = await listingRepo.save(
      listingRepo.create({
        title: 'Test Product',
        description: 'A test product',
        price: 100,
        currency: 'USD',
        address: '123 Test St',
        quantity: 10,
        reserved: 5,
        available: 5,
        userId: 'test-user-id',
        location: 'POINT(-122.4194 37.7749)',
        shareLocation: true,
      })
    );

    const releaseDto = {
      listingId: listing.id,
      userId: 'test-user-id',
      amount: 2,
    };

    return request(app.getHttpServer())
      .post('/inventory/release')
      .send(releaseDto)
      .expect(201)
      .then(response => {
        expect(response.body.available).toBe(7); // 5 + 2 = 7
        expect(response.body.reserved).toBe(3);  // 5 - 2 = 3
      });
  });

  it('/inventory/adjust (POST) - Adjust inventory', async () => {
    // Create a test listing
    const listing = await listingRepo.save(
      listingRepo.create({
        title: 'Test Product',
        description: 'A test product',
        price: 100,
        currency: 'USD',
        address: '123 Test St',
        quantity: 10,
        reserved: 0,
        available: 10,
        userId: 'test-user-id',
        location: 'POINT(-122.4194 37.7749)',
        shareLocation: true,
      })
    );

    const adjustDto = {
      listingId: listing.id,
      userId: 'test-user-id',
      change: 5, // Add 5 items
      note: 'Restocking',
    };

    return request(app.getHttpServer())
      .post('/inventory/adjust')
      .send(adjustDto)
      .expect(201)
      .then(response => {
        expect(response.body.quantity).toBe(15);  // 10 + 5 = 15
        expect(response.body.available).toBe(15); // 10 + 5 = 15
      });
  });

  it('/inventory/:listingId/history (GET) - Get inventory history', async () => {
    // Create a test listing
    const listing = await listingRepo.save(
      listingRepo.create({
        title: 'Test Product',
        description: 'A test product',
        price: 100,
        currency: 'USD',
        address: '123 Test St',
        quantity: 10,
        reserved: 0,
        available: 10,
        userId: 'test-user-id',
        location: 'POINT(-122.4194 37.7749)',
        shareLocation: true,
      })
    );

    // Make an adjustment to create history
    await request(app.getHttpServer())
      .post('/inventory/adjust')
      .send({
        listingId: listing.id,
        userId: 'test-user-id',
        change: 5,
        note: 'Initial restock',
      })
      .expect(201);

    return request(app.getHttpServer())
      .get(`/inventory/${listing.id}/history`)
      .expect(200)
      .then(response => {
        expect(Array.isArray(response.body)).toBeTruthy();
        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body[0].type).toBe('ADJUSTMENT');
        expect(response.body[0].change).toBe(5);
      });
  });

  it('Full order flow with inventory management', async () => {
    // Create a test listing with sufficient inventory
    const listing = await listingRepo.save(
      listingRepo.create({
        id: 'test-product-123',
        title: 'Test Product for Order',
        description: 'A test product for order flow',
        price: 50,
        currency: 'USD',
        address: '123 Test St',
        quantity: 5,
        reserved: 0,
        available: 5,
        userId: 'test-user-id',
        location: 'POINT(-122.4194 37.7749)',
        shareLocation: true,
      })
    );

    // Check initial inventory
    let response = await request(app.getHttpServer())
      .get(`/inventory/${listing.id}`)
      .expect(200);
      
    expect(response.body.available).toBe(5);

    // Create an order (this should reserve inventory)
    const createOrderDto = {
      items: [
        {
          productId: 'test-product-123',
          quantity: 2,
        },
      ],
      buyerId: 'test-user-id',
    };

    const orderResponse = await request(app.getHttpServer())
      .post('/orders')
      .send(createOrderDto)
      .expect(201);

    // Check inventory after order creation (should be reserved)
    response = await request(app.getHttpServer())
      .get(`/inventory/${listing.id}`)
      .expect(200);
      
    expect(response.body.available).toBe(3); // 5 - 2 = 3
    expect(response.body.reserved).toBe(2);  // 0 + 2 = 2

    // Update order status to paid (should confirm inventory and reduce quantity)
    await request(app.getHttpServer())
      .patch(`/orders/${orderResponse.body.id}/status`)
      .send({ status: 'paid' })
      .expect(200);

    // Check inventory after payment (should be permanently reduced)
    response = await request(app.getHttpServer())
      .get(`/inventory/${listing.id}`)
      .expect(200);
      
    expect(response.body.quantity).toBe(3);    // 5 - 2 = 3
    expect(response.body.available).toBe(3);   // 3 (no more reserved)
    expect(response.body.reserved).toBe(0);    // 2 - 2 = 0
  });
});