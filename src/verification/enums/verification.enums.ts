export enum VerificationType {
  EMAIL = 'email',
  PHONE = 'phone',
  IDENTITY = 'identity',
  SELLER = 'seller',
  BUSINESS = 'business',
}

export enum VerificationStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  REQUIRES_ACTION = 'requires_action',
}

export enum VerificationLevel {
  BASIC = 'basic',
  STANDARD = 'standard',
  PREMIUM = 'premium',
  VERIFIED_SELLER = 'verified_seller',
}

export enum DocumentType {
  ID_CARD = 'id_card',
  PASSPORT = 'passport',
  DRIVERS_LICENSE = 'drivers_license',
  BUSINESS_LICENSE = 'business_license',
  TAX_DOCUMENT = 'tax_document',
  ADDRESS_PROOF = 'address_proof',
  BANK_STATEMENT = 'bank_statement',
}

export enum VerificationStep {
  PERSONAL_INFO = 'personal_info',
  DOCUMENT_UPLOAD = 'document_upload',
  BUSINESS_VERIFICATION = 'business_verification',
  ADMIN_REVIEW = 'admin_review',
  COMPLETED = 'completed',
}
