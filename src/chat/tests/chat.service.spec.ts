import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from '../chat.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Chat } from '../chat.entity';
import { Repository } from 'typeorm';


const mockListing = { id: '1' } as any;
const mockUser1 = { id: 1 } as any;
const mockUser2 = { id: 2 } as any;
const mockTimestamp = new Date();

describe('ChatService', () => {
  let service: ChatService;
  let repo: Repository<Chat>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getRepositoryToken(Chat),
          useClass: Repository,
        },
      ],
    }).compile();
    service = module.get<ChatService>(ChatService);
    repo = module.get<Repository<Chat>>(getRepositoryToken(Chat));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a message', async () => {
    const chat = { id: 1, listingId: '1', senderId: 1, receiverId: 2, message: 'hi', status: 'sent', isRead: false, listing: mockListing, sender: mockUser1, receiver: mockUser2, timestamp: mockTimestamp } as Chat;
    jest.spyOn(repo, 'create').mockReturnValue(chat);
    jest.spyOn(repo, 'save').mockResolvedValue(chat);
    expect(await service.createMessage(chat)).toEqual(chat);
  });

  it('should get chat history', async () => {
    const chats = [
      { id: 1, listingId: '1', senderId: 1, receiverId: 2, message: 'hi', status: 'sent', isRead: false, listing: mockListing, sender: mockUser1, receiver: mockUser2, timestamp: mockTimestamp } as Chat,
    ];
    jest.spyOn(repo, 'find').mockResolvedValue(chats);
    expect(await service.getChatHistory('1', 1)).toEqual(chats);
  });

  it('should mark as read', async () => {
    const chat = { id: 1, listingId: '1', senderId: 1, receiverId: 2, message: 'hi', status: 'sent', isRead: false, listing: mockListing, sender: mockUser1, receiver: mockUser2, timestamp: mockTimestamp } as Chat;
    jest.spyOn(repo, 'findOne').mockResolvedValue(chat);
    jest.spyOn(repo, 'save').mockImplementation(async (c) => Object.assign(chat, c));
    const result = await service.markAsRead(1, 2);
    expect(result.isRead).toBe(true);
    expect(result.status).toBe('read');
  });

  it('should update status', async () => {
    const chat = { id: 1, listingId: '1', senderId: 1, receiverId: 2, message: 'hi', status: 'sent', isRead: false, listing: mockListing, sender: mockUser1, receiver: mockUser2, timestamp: mockTimestamp } as Chat;
    jest.spyOn(repo, 'findOne').mockResolvedValue(chat);
    jest.spyOn(repo, 'save').mockImplementation(async (c) => Object.assign(chat, c));
    const result = await service.updateStatus(1, 'delivered');
    expect(result.status).toBe('delivered');
  });
}); 