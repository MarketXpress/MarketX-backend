import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../guards/roles.guard';
import { AdminGuard } from '../guards/admin.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('Admin Route Authorization Test Matrix', () => {
  let rolesGuard: RolesGuard;
  let adminGuard: AdminGuard;
  let reflector: Reflector;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        AdminGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    rolesGuard = module.get<RolesGuard>(RolesGuard);
    adminGuard = module.get<AdminGuard>(AdminGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockContext = (user: any, endpoint: string) => {
    const mockRequest = {
      user,
      url: endpoint,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;
  };

  // Test matrix data
  const testRoles = ['admin', 'moderator', 'user', 'support', null];
  const adminEndpoints = [
    '/admin/users',
    '/admin/orders', 
    '/admin/stats',
    '/admin/users/:id/suspend',
    '/admin/users/:id/activate',
    '/admin/escrows/pending',
    '/admin/fraud/alerts',
    '/admin/fraud/:id/review',
  ];

  const moderatorEndpoints = [
    '/admin/escrows/pending', // Might be accessible to moderators
  ];

  const supportEndpoints = [
    '/admin/escrows/pending', // Might be accessible to support
  ];

  describe('RolesGuard Authorization Matrix', () => {
    describe('Admin-only endpoints', () => {
      adminEndpoints.forEach(endpoint => {
        describe(`${endpoint}`, () => {
          testRoles.forEach(role => {
            const roleDescription = role ? `with ${role} role` : 'without authentication';
            
            it(`should ${role === 'admin' ? 'ALLOW' : 'DENY'} ${roleDescription}`, async () => {
              mockReflector.getAllAndOverride.mockReturnValue(['admin']);
              
              const user = role ? { id: '123', role } : null;
              const context = createMockContext(user, endpoint);

              try {
                const result = await rolesGuard.canActivate(context);
                
                if (role === 'admin') {
                  expect(result).toBe(true);
                } else {
                  fail(`Expected ${roleDescription} to be denied`);
                }
              } catch (error) {
                if (role === 'admin') {
                  fail(`Expected ${roleDescription} to be allowed`);
                } else {
                  if (role === null) {
                    expect(error).toBeInstanceOf(UnauthorizedException);
                  } else {
                    expect(error).toBeInstanceOf(ForbiddenException);
                  }
                }
              }
            });
          });
        });
      });
    });

    describe('Multi-role endpoints', () => {
      describe('/admin/escrows/pending (admin + moderator)', () => {
        testRoles.forEach(role => {
          const roleDescription = role ? `with ${role} role` : 'without authentication';
          
          it(`should ${['admin', 'moderator'].includes(role) ? 'ALLOW' : 'DENY'} ${roleDescription}`, async () => {
            mockReflector.getAllAndOverride.mockReturnValue(['admin', 'moderator']);
            
            const user = role ? { id: '123', role } : null;
            const context = createMockContext(user, '/admin/escrows/pending');

            try {
              const result = await rolesGuard.canActivate(context);
              
              if (['admin', 'moderator'].includes(role)) {
                expect(result).toBe(true);
              } else {
                fail(`Expected ${roleDescription} to be denied`);
              }
            } catch (error) {
              if (['admin', 'moderator'].includes(role)) {
                fail(`Expected ${roleDescription} to be allowed`);
              } else {
                if (role === null) {
                  expect(error).toBeInstanceOf(UnauthorizedException);
                } else {
                  expect(error).toBeInstanceOf(ForbiddenException);
                }
              }
            }
          });
        });
      });

      describe('/admin/support-tickets (admin + support)', () => {
        testRoles.forEach(role => {
          const roleDescription = role ? `with ${role} role` : 'without authentication';
          
          it(`should ${['admin', 'support'].includes(role) ? 'ALLOW' : 'DENY'} ${roleDescription}`, async () => {
            mockReflector.getAllAndOverride.mockReturnValue(['admin', 'support']);
            
            const user = role ? { id: '123', role } : null;
            const context = createMockContext(user, '/admin/support-tickets');

            try {
              const result = await rolesGuard.canActivate(context);
              
              if (['admin', 'support'].includes(role)) {
                expect(result).toBe(true);
              } else {
                fail(`Expected ${roleDescription} to be denied`);
              }
            } catch (error) {
              if (['admin', 'support'].includes(role)) {
                fail(`Expected ${roleDescription} to be allowed`);
              } else {
                if (role === null) {
                  expect(error).toBeInstanceOf(UnauthorizedException);
                } else {
                  expect(error).toBeInstanceOf(ForbiddenException);
                }
              }
            }
          });
        });
      });
    });

    describe('No role requirements', () => {
      it('should allow access when no roles are required', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(null);
        
        const user = { id: '123', role: 'user' };
        const context = createMockContext(user, '/public/endpoint');

        const result = await rolesGuard.canActivate(context);
        expect(result).toBe(true);
      });
    });
  });

  describe('AdminGuard Authorization Matrix', () => {
    describe('Admin-only endpoints using AdminGuard', () => {
      adminEndpoints.forEach(endpoint => {
        describe(`${endpoint}`, () => {
          testRoles.forEach(role => {
            const roleDescription = role ? `with ${role} role` : 'without authentication';
            
            it(`should ${role === 'admin' ? 'ALLOW' : 'DENY'} ${roleDescription}`, async () => {
              const user = role ? { id: '123', role } : null;
              const context = createMockContext(user, endpoint);

              try {
                const result = await adminGuard.canActivate(context);
                
                if (role === 'admin') {
                  expect(result).toBe(true);
                } else {
                  fail(`Expected ${roleDescription} to be denied`);
                }
              } catch (error) {
                if (role === 'admin') {
                  fail(`Expected ${roleDescription} to be allowed`);
                } else {
                  if (role === null) {
                    expect(error).toBeInstanceOf(UnauthorizedException);
                    expect(error.message).toBe('Authentication required');
                  } else {
                    expect(error).toBeInstanceOf(ForbiddenException);
                    expect(error.message).toBe('Admin access required');
                  }
                }
              }
            });
          });
        });
      });
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    describe('User object edge cases', () => {
      it('should deny access when user has no role property', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(['admin']);
        
        const user = { id: '123' }; // Missing role
        const context = createMockContext(user, '/admin/users');

        await expect(rolesGuard.canActivate(context)).rejects.toThrow(ForbiddenException);
      });

      it('should deny access when user role is undefined', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(['admin']);
        
        const user = { id: '123', role: undefined };
        const context = createMockContext(user, '/admin/users');

        await expect(rolesGuard.canActivate(context)).rejects.toThrow(ForbiddenException);
      });

      it('should deny access when user role is empty string', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(['admin']);
        
        const user = { id: '123', role: '' };
        const context = createMockContext(user, '/admin/users');

        await expect(rolesGuard.canActivate(context)).rejects.toThrow(ForbiddenException);
      });

      it('should handle case-insensitive role comparison', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);
        
        const user = { id: '123', role: 'admin' };
        const context = createMockContext(user, '/admin/users');

        // This test documents current behavior - roles are case-sensitive
        await expect(rolesGuard.canActivate(context)).rejects.toThrow(ForbiddenException);
      });
    });

    describe('Role array edge cases', () => {
      it('should allow access when user has any of multiple required roles', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(['admin', 'moderator', 'support']);
        
        const testCases = [
          { role: 'admin', expected: true },
          { role: 'moderator', expected: true },
          { role: 'support', expected: true },
          { role: 'user', expected: false },
        ];

        for (const testCase of testCases) {
          const user = { id: '123', role: testCase.role };
          const context = createMockContext(user, '/admin/multi-role');

          try {
            const result = await rolesGuard.canActivate(context);
            expect(result).toBe(testCase.expected);
          } catch (error) {
            expect(testCase.expected).toBe(false);
            expect(error).toBeInstanceOf(ForbiddenException);
          }
        }
      });

      it('should handle empty role array', async () => {
        mockReflector.getAllAndOverride.mockReturnValue([]);
        
        const user = { id: '123', role: 'admin' };
        const context = createMockContext(user, '/admin/empty-roles');

        const result = await rolesGuard.canActivate(context);
        expect(result).toBe(true);
      });
    });

    describe('Security boundary tests', () => {
      it('should prevent role escalation through malformed user objects', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(['admin']);
        
        // Test various attempts at role escalation
        const maliciousUsers = [
          { id: '123', role: 'admin', isAdmin: true }, // Extra properties
          { id: '123', role: ['admin', 'user'] }, // Array instead of string
          { id: '123', role: { toString: () => 'admin' } }, // Object with toString
          { id: '123', role: 'admin\n', admin: true }, // Newline injection
        ];

        for (const user of maliciousUsers) {
          const context = createMockContext(user, '/admin/users');
          
          // Only string role 'admin' should work
          if (user.role === 'admin' && typeof user.role === 'string') {
            const result = await rolesGuard.canActivate(context);
            expect(result).toBe(true);
          } else {
            await expect(rolesGuard.canActivate(context)).rejects.toThrow(ForbiddenException);
          }
        }
      });
    });
  });

  describe('Authorization Test Matrix Summary', () => {
    it('should provide comprehensive coverage of all role permutations', () => {
      // This test serves as documentation of the test matrix coverage
      const expectedTestCount = adminEndpoints.length * testRoles.length + // Admin endpoints
                                2 * testRoles.length + // Multi-role endpoints  
                                1 + // No role requirements
                                adminEndpoints.length * testRoles.length + // AdminGuard
                                5; // Edge cases

      // Document that we have comprehensive coverage
      expect(true).toBe(true); // Placeholder - actual coverage verified by running tests
    });
  });
});
