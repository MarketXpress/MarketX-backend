export enum MilestoneStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  RELEASED = 'released',
  REJECTED = 'rejected',
  DISPUTED = 'disputed',
  CANCELLED = 'cancelled',
}

export enum MilestoneType {
  MATERIALS = 'materials',
  PRODUCTION = 'production',
  SHIPPING = 'shipping',
  DELIVERY = 'delivery',
  FINAL_INSPECTION = 'final_inspection',
  CUSTOM = 'custom',
}

export enum MilestoneTrigger {
  AUTOMATIC = 'automatic',
  MANUAL = 'manual',
  TRACKING_UPDATE = 'tracking_update',
  DELIVERY_CONFIRMATION = 'delivery_confirmation',
  ADMIN_APPROVAL = 'admin_approval',
}

export interface MilestoneConfig {
  id: string;
  title: string;
  description: string;
  amount: number;
  percentage: number;
  type: MilestoneType;
  trigger: MilestoneTrigger;
  requiredDocuments?: string[];
  autoRelease: boolean;
  releaseConditions?: string[];
  sortOrder: number;
}
