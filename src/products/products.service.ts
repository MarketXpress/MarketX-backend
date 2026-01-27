import { Injectable, ForbiddenException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { Product } from './interfaces/product.interface';

@Injectable()
export class ProductsService {
  private products: Product[] = [];

  create(sellerId: string, dto: CreateProductDto): Product {
    const product: Product = {
      id: crypto.randomUUID(),
      sellerId,
      name: dto.name,
      category: dto.category,
      price: dto.price,
      description: dto.description,
      images: dto.images,
      createdAt: new Date(),
    };

    this.products.push(product);
    return product;
  }

  findAll(filters: FilterProductDto): Product[] {
    const { search, category, minPrice, maxPrice, limit, offset } = filters;

    return this.products
      .filter(p =>
        (!search || p.name.toLowerCase().includes(search.toLowerCase())) &&
        (!category || p.category === category) &&
        (minPrice === undefined || p.price >= minPrice) &&
        (maxPrice === undefined || p.price <= maxPrice),
      )
      .slice(offset, offset + limit);
  }

  findOne(id: string): Product | undefined {
    return this.products.find(p => p.id === id);
  }

  update(id: string, sellerId: string, dto: UpdateProductDto): Product {
    const product = this.findOne(id);

    if (!product || product.sellerId !== sellerId) {
      throw new ForbiddenException('Not allowed to update this product');
    }

    Object.assign(product, dto);
    return product;
  }

  remove(id: string, sellerId: string) {
    const product = this.findOne(id);

    if (!product || product.sellerId !== sellerId) {
      throw new ForbiddenException('Not allowed to delete this product');
    }

    this.products = this.products.filter(p => p.id !== id);
    return { deleted: true };
  }
}
