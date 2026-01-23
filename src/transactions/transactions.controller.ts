import {
  Controller,
  Get,
  UseGuards,
  Request,
  HttpStatus,
  Logger,
  Query,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TransactionsService } from './transactions.service';
import { Transaction } from './entities/transaction.entity';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    role?: string;
  };
}

@ApiTags('Transactions')
@Controller('transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  private readonly logger = new Logger(TransactionsController.name);

  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('my')
  @ApiOperation({
    summary: 'Get user transactions',
    description:
      'Fetch all transactions where the authenticated user is either the sender or receiver. Results are sorted by date in descending order.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User transactions retrieved successfully',
    type: [Transaction],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Valid JWT token required',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error',
  })
  async getMyTransactions(
    @Request() req: AuthenticatedRequest,
  ): Promise<Transaction[]> {
    const userId = req.user.id;
    this.logger.log(`User ${userId} requesting their transactions`);

    return this.transactionsService.getUserTransactions(userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all transactions with filtering',
    description:
      'Fetch all transactions with optional filtering by status, type, date range, and search. Supports pagination.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 10)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by transaction status',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by transaction type',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Filter by start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Filter by end date (ISO format)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search in transaction descriptions',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transactions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        transactions: {
          type: 'array',
          items: { $ref: '#/components/schemas/Transaction' },
        },
        total: { type: 'number' },
      },
    },
  })
  async getAllTransactions(
    @Query() query: any,
  ): Promise<{ transactions: Transaction[]; total: number }> {
    this.logger.log('Fetching all transactions with filters', { query });

    const options = {
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 10,
      status: query.status,
      type: query.type,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      search: query.search,
    };

    return this.transactionsService.getAllTransactions(options);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search transactions',
    description:
      'Search transactions by various criteria including user, amount range, and date range.',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter by user ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by transaction status',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by transaction type',
  })
  @ApiQuery({
    name: 'minAmount',
    required: false,
    description: 'Minimum amount filter',
  })
  @ApiQuery({
    name: 'maxAmount',
    required: false,
    description: 'Maximum amount filter',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Filter by start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Filter by end date (ISO format)',
  })
  @ApiQuery({
    name: 'description',
    required: false,
    description: 'Search in transaction descriptions',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Search results retrieved successfully',
    type: [Transaction],
  })
  async searchTransactions(@Query() query: any): Promise<Transaction[]> {
    this.logger.log('Searching transactions with criteria', { query });

    const criteria = {
      userId: query.userId ? parseInt(query.userId) : undefined,
      status: query.status,
      type: query.type,
      minAmount: query.minAmount ? parseFloat(query.minAmount) : undefined,
      maxAmount: query.maxAmount ? parseFloat(query.maxAmount) : undefined,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      description: query.description,
    };

    return this.transactionsService.searchTransactions(criteria);
  }

  @Get(':hash')
  @ApiOperation({
    summary: 'Verify transaction on Stellar blockchain',
    description:
      'Get transaction details from Stellar Horizon and verify against local database record.',
  })
  @ApiParam({ name: 'hash', description: 'Stellar transaction hash' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transaction verification completed successfully',
    schema: {
      type: 'object',
      properties: {
        stellarTransaction: { type: 'object' },
        localTransaction: { $ref: '#/components/schemas/Transaction' },
        isVerified: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Transaction not found on Stellar network',
  })
  async verifyTransaction(@Param('hash') hash: string) {
    this.logger.log(`Verifying transaction with hash: ${hash}`);

    return this.transactionsService.verifyStellarTransaction(hash);
  }
}
