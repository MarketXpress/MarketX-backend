import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    HttpStatus,
    Logger,
    Query,
  } from '@nestjs/common';
  import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
  } from '@nestjs/swagger';
  import { AdminGuard } from '../guards/admin.guard';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  import { RolesGuard } from '../guards/roles.guard';
  import { Roles, Admin } from '../decorators/roles.decorator';
  import { AdminService } from '../services/admin.service';
  
  @ApiTags('Admin')
  @Controller('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard) // Apply to all routes in this controller
  export class AdminController {
    private readonly logger = new Logger(AdminController.name);
  
    constructor(private readonly adminService: AdminService) {}
  
    @Get('users')
    @ApiOperation({ summary: 'Get all users (Admin only)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Users retrieved successfully',
    })
    @ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Admin access required',
    })
    async getAllUsers(
      @Query('page') page: number = 1,
      @Query('limit') limit: number = 10,
    ) {
      this.logger.log('Admin accessing all users');
      return this.adminService.getAllUsers(page, limit);
    }
  
    @Get('users/:id')
    @ApiOperation({ summary: 'Get user by ID (Admin only)' })
    @ApiParam({ name: 'id', description: 'User ID' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'User retrieved successfully',
    })
    @ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'User not found',
    })
    async getUserById(@Param('id') id: string) {
      this.logger.log(`Admin accessing user ${id}`);
      return this.adminService.getUserById(+id);
    }
  
    @Put('users/:id/role')
    @ApiOperation({ summary: 'Update user role (Admin only)' })
    @ApiParam({ name: 'id', description: 'User ID' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'User role updated successfully',
    })
    async updateUserRole(
      @Param('id') id: string,
      @Body() updateRoleDto: { role: string },
    ) {
      this.logger.log(`Admin updating role for user ${id} to ${updateRoleDto.role}`);
      return this.adminService.updateUserRole(+id, updateRoleDto.role);
    }
  
    @Delete('users/:id')
    @ApiOperation({ summary: 'Delete user (Admin only)' })
    @ApiParam({ name: 'id', description: 'User ID' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'User deleted successfully',
    })
    async deleteUser(@Param('id') id: string) {
      this.logger.log(`Admin deleting user ${id}`);
      return this.adminService.deleteUser(+id);
    }
  
    @Get('statistics')
    @ApiOperation({ summary: 'Get system statistics (Admin only)' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Statistics retrieved successfully',
    })
    async getStatistics() {
      this.logger.log('Admin accessing system statistics');
      return this.adminService.getSystemStatistics();
    }
  
    @Post('maintenance-mode')
    @ApiOperation({ summary: 'Toggle maintenance mode (Admin only)' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Maintenance mode toggled successfully',
    })
    async toggleMaintenanceMode(@Body() toggleDto: { enabled: boolean }) {
      this.logger.log(`Admin toggling maintenance mode: ${toggleDto.enabled}`);
      return this.adminService.toggleMaintenanceMode(toggleDto.enabled);
    }
  }
  