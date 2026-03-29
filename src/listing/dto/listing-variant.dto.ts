export class ListingVariantDto {
  sku?: string;
  attributes?: Record<string, any>;
  price: number;
  currency?: string;
  quantity?: number;
  reserved?: number;
}
