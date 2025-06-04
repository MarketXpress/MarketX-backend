import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from '../admin.controller';
import { AdminService } from '../../services/admin.service';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: AdminService;

  const mockAdminService = {
    getAllUsers: jest.fn(),
    getUserById: jest.fn(),
    updateUserRole: jest.fn(),
    deleteUser: jest.fn(),
    getSystemStatistics: jest.fn(),
    toggleMaintenanceMode: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('should return paginated users', async () => {
      const mockResult = {
        users: [
          { id: 1, email: 'user1@example.com', role: 'user' },
          { id: 2, email: 'user2@example.com', role: 'admin' },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
      };

      mockAdminService.getAllUsers.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers(1, 10);

      expect(result).toEqual(mockResult);
      expect(adminService.getAllUsers).toHaveBeenCalledWith(1, 10);
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      const mockUser = {
        id: 1,
        email: 'user@example.com',
        role: 'user',
      };

      mockAdminService.getUserById.mockResolvedValue(mockUser);

      const result = await controller.getUserById('1');

      expect(result).toEqual(mockUser);
      expect(adminService.getUserById).toHaveBeenCalledWith(1);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role', async () => {
      const mockResult = {
        message: 'User role updated successfully',
        user: {
          id: 1,
          email: 'user@example.com',
          role: 'admin',
        },
      };

      mockAdminService.updateUserRole.mockResolvedValue(mockResult);

      const result = await controller.updateUserRole('1', { role: 'admin' });

      expect(result).toEqual(mockResult);
      expect(adminService.updateUserRole).toHaveBeenCalledWith(1, 'admin');
    });
  });

  describe('getStatistics', () => {
    it('should return system statistics', async () => {
      const mockStats = {
        users: {
          total: 100,
          admin: 5,
          moderator: 10,
          regular: 85,
          recentSignups: 15,
        },
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      mockAdminService.getSystemStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStatistics();

      expect(result).toEqual(mockStats);
      expect(adminService.getSystemStatistics).toHaveBeenCalled();
    });
  });
});