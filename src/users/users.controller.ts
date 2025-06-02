import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
    ValidationPipe,
  } from '@nestjs/common';
  import { 
    ApiTags, 
    ApiOperation, 
    ApiResponse, 
    ApiBearerAuth,
    ApiBody 
  } from '@nestjs/swagger';
  import { UsersService } from './users.service';
  import { CreateUserDto } from './dto/create-user.dto';
  import { UpdateProfileDto } from './dto/update-profile.dto';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  import { User } from './user.entity';
  
  @ApiTags('users')
  @Controller('users')
  export class UsersController {
    constructor(private readonly usersService: UsersService) {}
  
    @Post()
    @ApiOperation({ summary: 'Create a new user' })
    @ApiResponse({ status: 201, description: 'User created successfully', type: User })
    @ApiResponse({ status: 400, description: 'Bad request' })
    create(@Body(ValidationPipe) createUserDto: CreateUserDto): Promise<User> {
      return this.usersService.create(createUserDto);
    }
  
    @Get()
    @ApiOperation({ summary: 'Get all users' })
    @ApiResponse({ status: 200, description: 'List of all users', type: [User] })
    findAll(): Promise<User[]> {
      return this.usersService.findAll();
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Get user by ID' })
    @ApiResponse({ status: 200, description: 'User found', type: User })
    @ApiResponse({ status: 404, description: 'User not found' })
    findOne(@Param('id') id: string): Promise<User> {
      return this.usersService.findOne(+id);
    }
  
    @Patch('profile')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update authenticated user profile' })
    @ApiBody({ type: UpdateProfileDto })
    @ApiResponse({ 
      status: 200, 
      description: 'Profile updated successfully', 
      type: User 
    })
    @ApiResponse({ 
      status: 400, 
      description: 'Bad request - Invalid input data' 
    })
    @ApiResponse({ 
      status: 401, 
      description: 'Unauthorized - Valid JWT token required' 
    })
    @ApiResponse({ 
      status: 404, 
      description: 'User not found' 
    })
    async updateProfile(
      @Request() req: any,
      @Body(ValidationPipe) updateProfileDto: UpdateProfileDto,
    ): Promise<User> {
      const userId = req.user.id;
      return await this.usersService.updateProfile(userId, updateProfileDto);
    }
  
    @Delete(':id')
    @ApiOperation({ summary: 'Delete user by ID' })
    @ApiResponse({ status: 200, description: 'User deleted successfully' })
    @ApiResponse({ status: 404, description: 'User not found' })
    remove(@Param('id') id: string): Promise<void> {
      return this.usersService.remove(+id);
    }
  }