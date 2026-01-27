export interface Product {
  id: string;
  sellerId: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  images: string[];
  createdAt: Date;
}
