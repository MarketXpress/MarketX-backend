export class CreateListingDto {
  title: string;
  description: string;
  price: number;
  category: string;
  location: string;
  expiresAt?: Date;
}
