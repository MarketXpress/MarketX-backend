// Create this file: src/escrow/tests/setup.ts
// Global test setup and mocks

// Mock the users entity that's causing the import issue
jest.mock('src/users/users.entity', () => ({
  Users: class Users {
    id: string;
    email: string;
    username: string;
    createdAt: Date;
    updatedAt: Date;
    
    constructor() {
      this.id = '';
      this.email = '';
      this.username = '';
      this.createdAt = new Date();
      this.updatedAt = new Date();
    }
  }
}));

// Global test timeout
jest.setTimeout(30000);

// Global cleanup for timers and handles
afterAll(() => {
  jest.useRealTimers();
});

// Mock the schedule decorator to prevent cron jobs from running
jest.mock('@nestjs/schedule', () => ({
  ...jest.requireActual('@nestjs/schedule'),
  Cron: () => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    // Mock decorator that does nothing
    return descriptor;
  },
  SchedulerRegistry: jest.fn().mockImplementation(() => ({
    addCronJob: jest.fn(),
    deleteCronJob: jest.fn(),
    getCronJob: jest.fn(),
    getCronJobs: jest.fn()
  }))
}));
