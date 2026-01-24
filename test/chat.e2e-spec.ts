import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';

describe('Chat E2E', () => {
  let app: INestApplication;
  let server: Server;
  let httpServer;
  let client1: ClientSocket;
  let client2: ClientSocket;
  let listingId = 'test-listing';
  let senderId = 1;
  let receiverId = 2;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    httpServer = createServer();
    server = new Server(httpServer);
    httpServer.listen(4001);
    client1 = Client('http://localhost:3000');
    client2 = Client('http://localhost:3000');
  });

  afterAll(async () => {
    client1.close();
    client2.close();
    await app.close();
    httpServer.close();
  });

  it('should join room and send/receive messages', (done) => {
    client1.emit('joinRoom', { listingId, userId: senderId });
    client2.emit('joinRoom', { listingId, userId: receiverId });
    client2.on('joinedRoom', () => {
      client1.emit('sendMessage', { listingId, senderId, receiverId, message: 'Hello' });
    });
    client2.on('newMessage', (msg) => {
      expect(msg.message).toBe('Hello');
      done();
    });
  });

  it('should fetch chat history', async () => {
    const res = await request(app.getHttpServer())
      .get(`/chat/history/${listingId}?userId=${senderId}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].message).toBe('Hello');
  });

  it('should update message status', (done) => {
    client2.on('newMessage', (msg) => {
      client2.emit('messageRead', { messageId: msg.id, userId: receiverId });
      client1.on('messageStatusUpdated', (updated) => {
        expect(updated.status).toBe('read');
        done();
      });
    });
    client1.emit('sendMessage', { listingId, senderId, receiverId, message: 'Second message' });
  });
}); 