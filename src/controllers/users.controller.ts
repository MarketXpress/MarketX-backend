import {
    Controller,
    Get,
    Post,
    Put,
    Body,
    Param,
    UseGuards,
    HttpStatus,
    Req,
  } from '@nestjs/common';
  import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
  } from '@nestjs/swagger';
  import { Request } from 'express';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  import { RolesGuard } from '../guards/roles.guard';
  import { Roles, Admin, Public } from '../decorators/roles.decorator';
  import { UsersService } from '../services/users.service';
  
  interface AuthenticatedRequest extends Request {
    user: {
      id: number;
      email: string;
      role: string;
    };
  }
  
  @ApiTags('Users')
  @Controller('users')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  export class UsersController {
    constructor(private readonly usersService: UsersService) {}
  
    @Get('profile')
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Profile retrieved successfully',
    })
    async getProfile(@Req() req: AuthenticatedRequest) {
      // Any authenticated user can access their own profile
      return this.usersService.getUserById(req.user.id);
    }
  
    @Put('profile')
    @ApiOperation({ summary: 'Update current user profile' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Profile updated successfully',
    })
    async updateProfile(
      @Req() req: AuthenticatedRequest,
      @Body() updateDto: any,
    ) {
      // Any authenticated user can update their own profile
      return this.usersService.updateUser(req.user.id, updateDto);
    }
  
    @Get()
    @Roles('admin', 'moderator') // Only admin or moderator can list all users
    @ApiOperation({ summary: 'Get all users (Admin/Moderator only)' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Users retrieved successfully',
    })
    async getAllUsers() {
      return this.usersService.getAllUsers();
    }
  
    @Post(':id/ban')
    @Admin() // Only admin can ban users
    @ApiOperation({ summary: 'Ban user (Admin only)' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'User banned successfully',
    })
    async banUser(@Param('id') id: string) {
      return this.usersService.banUser(+id);
    }
  
    @Post(':id/unban')
    @Admin() // Only admin can unban users
    @ApiOperation({ summary: 'Unban user (Admin only)' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'User unbanned successfully',
    })
    async unbanUser(@Param('id') id: string) {
      return this.usersService.unbanUser(+id);
    }
  }