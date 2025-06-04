import {
  Controller,
  Get,
  UseGuards,
  Request,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
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
    description: 'Fetch all transactions where the authenticated user is either the sender or receiver. Results are sorted by date in descending order.'
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
  async getMyTransactions(@Request() req: AuthenticatedRequest): Promise<Transaction[]> {
    const userId = req.user.id;
    this.logger.log(`User ${userId} requesting their transactions`);
    
    return this.transactionsService.getUserTransactions(userId);
  }
} 