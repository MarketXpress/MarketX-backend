export interface PasswordResetEmailDto {
    userId?: string;
    to: string;
    name: string;
    resetUrl: string;
    /** Human-readable token expiry e.g. "15 minutes" */
    expiryTime: string;
}
