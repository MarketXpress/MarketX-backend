import { ListingVariantDto } from './listing-variant.dto';

export class CreateListingDto {
  title: string;
  description: string;

  // Deprecated as root-level pricing - use variants whenever available
  price?: number;
  currency?: string;
  quantity?: number;
  reserved?: number;
  available?: number;

  category: string;
  location: string;
  expiresAt?: Date;
  variants?: ListingVariantDto[];
}
