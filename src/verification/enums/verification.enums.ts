export enum VerificationType {
  EMAIL = 'email',
  PHONE = 'phone',
  IDENTITY = 'identity',
}

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export enum VerificationLevel {
  BASIC = 'basic',
  STANDARD = 'standard',
  PREMIUM = 'premium',
}
