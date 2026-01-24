import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { UsersService } from './user.service';
import { UpdateProfileDto } from './update-profile.dto';
import { ProfileResponseDto } from './profile-response.dto';
import { PublicProfileDto } from './public-profile.dto';
// You'll need to create these guards based on your auth implementation
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  // @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfile(@Request() req): Promise<ProfileResponseDto> {
    // Assuming req.user.id is set by JwtAuthGuard
    const userId = req.user?.id || req.user?.userId;
    return this.usersService.getProfile(userId);
  }

  @Patch('profile')
  // @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Wallet address already in use' })
  async updateProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const userId = req.user?.id || req.user?.userId;
    return this.usersService.updateProfile(userId, updateProfileDto);
  }

  @Get(':id/public')
  @ApiOperation({ summary: 'Get public profile of any user' })
  @ApiResponse({
    status: 200,
    description: 'Public profile retrieved successfully',
    type: PublicProfileDto,
  })
  @ApiResponse({ status: 403, description: 'Profile is private' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getPublicProfile(
    @Param('id') userId: string,
    @Request() req,
  ): Promise<PublicProfileDto> {
    // If user is authenticated, pass their ID to check privacy settings
    const requesterId = req.user?.id || req.user?.userId;
    return this.usersService.getPublicProfile(userId, requesterId);
  }

  @Get('profile/transactions')
  // @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get transaction history for current user' })
  @ApiResponse({
    status: 200,
    description: 'Transaction history retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTransactionHistory(@Request() req): Promise<any[]> {
    const userId = req.user?.id || req.user?.userId;
    return this.usersService.getUserTransactionHistory(userId);
  }

  @Get('profile/reviews')
  // @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get reviews received by current user (as seller)' })
  @ApiResponse({
    status: 200,
    description: 'Reviews retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getReviews(@Request() req): Promise<any[]> {
    const userId = req.user?.id || req.user?.userId;
    return this.usersService.getUserReviews(userId);
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: 'Get public reviews for any user' })
  @ApiResponse({
    status: 200,
    description: 'Reviews retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getPublicReviews(@Param('id') userId: string): Promise<any[]> {
    return this.usersService.getUserReviews(userId);
  }
}