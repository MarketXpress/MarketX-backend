/**
 * Escrow Status Enum
 * Defines all possible states of an escrow
 */
export enum EscrowStatus {
  PENDING = 'PENDING',
  LOCKED = 'LOCKED',
  PARTIALLY_RELEASED = 'PARTIALLY_RELEASED',
  RELEASED = 'RELEASED',
  DISPUTED = 'DISPUTED',
  EXPIRED = 'EXPIRED',
  REFUNDED = 'REFUNDED'
}

/**
 * Escrow Operation Enum
 * Defines all possible operations on escrow
 */
export enum EscrowOperation {
  CREATE = 'CREATE',
  LOCK = 'LOCK',
  RELEASE = 'RELEASE',
  PARTIAL_RELEASE = 'PARTIAL_RELEASE',
  CONFIRM = 'CONFIRM',
  DISPUTE = 'DISPUTE',
  RESOLVE = 'RESOLVE',
  TIMEOUT = 'TIMEOUT'
}

/**
 * Dispute Reason Enum
 * Standardized dispute reasons
 */
export enum DisputeReason {
  QUALITY_ISSUE = 'QUALITY_ISSUE',
  NON_DELIVERY = 'NON_DELIVERY',
  LATE_DELIVERY = 'LATE_DELIVERY',
  INCORRECT_AMOUNT = 'INCORRECT_AMOUNT',
  UNAUTHORIZED_TRANSACTION = 'UNAUTHORIZED_TRANSACTION',
  OTHER = 'OTHER'
}

/**
 * Core Escrow Entity Interface
 */
export interface IEscrowEntity {
  id: string;
  transactionId: string;
  amount: number;
  status: EscrowStatus;
  createdAt: Date;
  releasedAt?: Date;
  timeoutAt: Date;
  disputeReason?: DisputeReason;
  releasedTo?: string;
  version: number;
}

/**
 * Stellar Transaction Interface
 */
export interface IStellarTransaction {
  txHash: string;
  operation: EscrowOperation;
  sourceAccount: string;
  destinationAccount?: string;
  amount?: number;
  memo?: string;
  createdAt: Date;
}

/**
 * Dispute Resolution Interface
 */
export interface IDisputeResolution {
  escrowId: string;
  resolution: 'release' | 'refund';
  resolvedBy: string;
  resolvedAt: Date;
  reason?: string;
}

/**
 * Escrow Service Interface
 */
export interface IEscrowService {
  createEscrow(dto: CreateEscrowDto): Promise<IEscrowEntity>;
  lockFunds(escrowId: string): Promise<IStellarTransaction>;
  releaseFunds(dto: ReleaseEscrowDto): Promise<IStellarTransaction>;
  confirmReceipt(dto: ConfirmReceiptDto): Promise<void>;
  initiateDispute(dto: InitiateDisputeDto): Promise<IEscrowEntity>;
  resolveDispute(dto: ResolveDisputeDto): Promise<IStellarTransaction>;
  handlePartialRelease(dto: PartialReleaseDto): Promise<IStellarTransaction>;
  getEscrowStatus(escrowId: string): Promise<IEscrowEntity>;
}

/**
 * Type Guards
 */
export function isEscrowStatus(status: string): status is EscrowStatus {
  return Object.values(EscrowStatus).includes(status as EscrowStatus);
}

export function isDisputeReason(reason: string): reason is DisputeReason {
  return Object.values(DisputeReason).includes(reason as DisputeReason);
}

/**
 * Generic Response Types
 */
export type EscrowResponse<T = unknown> = {
  data: T;
  meta?: {
    timestamp: Date;
    operation: EscrowOperation;
  };
};

export type ErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: {
    timestamp: Date;
    operation?: EscrowOperation;
  };
};
