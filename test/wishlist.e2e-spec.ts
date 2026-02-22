import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Wishlist } from '../src/wishlist/entities/wishlist.entity';
import { WishlistItem } from '../src/wishlist/entities/wishlist-item.entity';
import { Product } from '../src/entities/product.entity';
import { User } from '../src/entities/user.entity';
import { AuthModule } from '../src/auth/auth.module';

describe('Wishlist Controller (e2e)', () => {
  let app: INestApplication;
  let wishlistRepo: Repository<Wishlist>;
  let itemRepo: Repository<WishlistItem>;
  let productRepo: Repository<Product>;
  let userRepo: Repository<User>;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get repositories
    wishlistRepo = app.get(getRepositoryToken(Wishlist));
    itemRepo = app.get(getRepositoryToken(WishlistItem));
    productRepo = app.get(getRepositoryToken(Product));
    userRepo = app.get(getRepositoryToken(User));

    // Clean up any existing test data
    await itemRepo.clear();
    await wishlistRepo.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Create a test user for authentication
    const testUser = userRepo.create({
      id: 'test-user-id',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      password: 'hashedPassword',
      isActive: true,
    });
    await userRepo.save(testUser);

    // Mock authentication token (in a real scenario, you'd authenticate)
    // For testing purposes, we'll use a mock user ID in the requests
  });

  it('/POST wishlists (create wishlist)', async () => {
    const createWishlistDto = {
      name: 'My Test Wishlist',
      description: 'A test wishlist',
      isPublic: false,
    };

    return request(app.getHttpServer())
      .post('/wishlists')
      .send(createWishlistDto)
      .expect(201)
      .then(response => {
        expect(response.body.name).toBe(createWishlistDto.name);
        expect(response.body.description).toBe(createWishlistDto.description);
        expect(response.body.isPublic).toBe(createWishlistDto.isPublic);
      });
  });

  it('/GET wishlists (get user wishlists)', async () => {
    return request(app.getHttpServer())
      .get('/wishlists')
      .expect(200)
      .then(response => {
        expect(Array.isArray(response.body)).toBeTruthy();
      });
  });

  it('/POST wishlists/:id/items (add item to wishlist)', async () => {
    // First create a wishlist
    const wishlist = await wishlistRepo.save(
      wishlistRepo.create({
        userId: 'test-user-id',
        name: 'Test Wishlist for Items',
        isPublic: false,
      })
    );

    // Create a test product
    const product = await productRepo.save(
      productRepo.create({
        id: 'test-product-id',
        title: 'Test Product',
        description: 'A test product',
        price: 100,
        status: 'active',
        available: 5,
        isActive: true,
        userId: 'test-user-id',
      })
    );

    const addItemDto = {
      productId: product.id,
      productName: product.title,
      currentPrice: 100,
      productImageUrl: 'https://example.com/test-image.jpg',
      productUrl: 'https://example.com/test-product',
    };

    return request(app.getHttpServer())
      .post(`/wishlists/${wishlist.id}/items`)
      .send(addItemDto)
      .expect(201)
      .then(response => {
        expect(response.body.productId).toBe(addItemDto.productId);
        expect(response.body.productName).toBe(addItemDto.productName);
        expect(response.body.currentPrice).toBe(addItemDto.currentPrice);
      });
  });

  it('/GET wishlists/share/:token (get shared wishlist)', async () => {
    // Create a public wishlist with a share token
    const wishlist = await wishlistRepo.save(
      wishlistRepo.create({
        userId: 'test-user-id',
        name: 'Public Test Wishlist',
        isPublic: true,
        shareToken: 'test-share-token-12345',
      })
    );

    // Add an item to the wishlist
    await itemRepo.save(
      itemRepo.create({
        wishlistId: wishlist.id,
        productId: 'test-product-id',
        productName: 'Test Product',
        priceAtAdded: 100,
        currentPrice: 100,
        isAvailable: true,
      })
    );

    return request(app.getHttpServer())
      .get(`/wishlists/share/${wishlist.shareToken}`)
      .expect(200)
      .then(response => {
        expect(response.body.id).toBe(wishlist.id);
        expect(response.body.isPublic).toBe(true);
        expect(Array.isArray(response.body.items)).toBeTruthy();
      });
  });

  it('/DELETE wishlists/:id (delete wishlist)', async () => {
    // Create a wishlist to delete
    const wishlist = await wishlistRepo.save(
      wishlistRepo.create({
        userId: 'test-user-id',
        name: 'Wishlist to Delete',
        isPublic: false,
      })
    );

    return request(app.getHttpServer())
      .delete(`/wishlists/${wishlist.id}`)
      .expect(204);
  });
});