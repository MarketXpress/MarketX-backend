import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  // Add your user-related methods here
  constructor() {}

  // Example method
  findAll() {
    return ['user1', 'user2'];
  }
}
