import { Users } from '../users/users.entity';

declare global {
  namespace Express {
    interface Request {
      user?: Users;
    }
  }
} 