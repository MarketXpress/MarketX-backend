import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import {
  Product,
  ProductPriceHistoryEntry,
} from './interfaces/product.interface';
import { UpdatePriceDto } from './dto/update-price.dto';
import { PricingService, SupportedCurrency } from './services/pricing.service';
import { MediaService } from '../media/media.service';

@Injectable()
export class ProductsService {
  private products: Product[] = [];

  constructor(
    private readonly pricingService: PricingService,
    private readonly eventEmitter: EventEmitter2,
    private readonly mediaService: MediaService,
  ) {}

  create(sellerId: string, dto: CreateProductDto): Product {
    const basePrice = dto.basePrice ?? dto.price;
    const baseCurrency =
      dto.baseCurrency ?? dto.currency ?? SupportedCurrency.USD;

    if (basePrice === undefined) {
      throw new BadRequestException('Price is required.');
    }

    this.pricingService.validatePrice(basePrice, baseCurrency);

    const initialHistory: ProductPriceHistoryEntry = {
      id: crypto.randomUUID(),
      basePrice,
      baseCurrency,
      changedAt: new Date(),
      updatedBy: sellerId,
      reason: 'initial_price',
    };

    const product: Product = {
      id: crypto.randomUUID(),
      sellerId,
      name: dto.name,
      category: dto.category,
      basePrice,
      baseCurrency,
      price: basePrice,
      currency: baseCurrency,
      description: dto.description,
      images: dto.images,
      createdAt: new Date(),
      updatedAt: new Date(),
      priceHistory: [initialHistory],
    };

    this.products.push(product);
    return product;
  }

  findAll(filters: FilterProductDto) {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      limit,
      offset,
      preferredCurrency,
    } = filters;

    return this.products
      .map((product) => this.toDisplayProduct(product, preferredCurrency))
      .filter(
        (product) =>
          (!search ||
            product.name.toLowerCase().includes(search.toLowerCase())) &&
          (!category || product.category === category) &&
          (minPrice === undefined || product.convertedPrice >= minPrice) &&
          (maxPrice === undefined || product.convertedPrice <= maxPrice),
      )
      .slice(offset, offset + limit);
  }

  findOne(id: string, preferredCurrency?: SupportedCurrency) {
    const product = this.products.find((p) => p.id === id);
    if (!product) {
      return undefined;
    }
    return this.toDisplayProduct(product, preferredCurrency);
  }

  update(id: string, sellerId: string, dto: UpdateProductDto): Product {
    const product = this.products.find((p) => p.id === id);

    if (!product || product.sellerId !== sellerId) {
      throw new ForbiddenException('Not allowed to update this product');
    }

    const { basePrice, baseCurrency, price, currency, ...rest } =
      dto as UpdateProductDto & {
        basePrice?: number;
        baseCurrency?: SupportedCurrency;
        currency?: SupportedCurrency;
      };

    if (
      basePrice !== undefined ||
      baseCurrency !== undefined ||
      price !== undefined ||
      currency !== undefined
    ) {
      this.updatePrice(id, sellerId, {
        basePrice: basePrice ?? price ?? product.basePrice,
        baseCurrency: baseCurrency ?? currency ?? product.baseCurrency,
      });
    }

    Object.assign(product, rest);
    product.updatedAt = new Date();

    return product;
  }

  updatePrice(id: string, sellerId: string, dto: UpdatePriceDto): Product {
    const product = this.products.find((p) => p.id === id);

    if (!product || product.sellerId !== sellerId) {
      throw new ForbiddenException('Not allowed to update this product price');
    }

    this.pricingService.validatePrice(dto.basePrice, dto.baseCurrency);

    const hasChanged =
      product.basePrice !== dto.basePrice ||
      product.baseCurrency !== dto.baseCurrency;

    if (!hasChanged) {
      return product;
    }

    product.basePrice = dto.basePrice;
    product.baseCurrency = dto.baseCurrency;
    product.price = dto.basePrice;
    product.currency = dto.baseCurrency;
    product.updatedAt = new Date();
    product.priceHistory.push({
      id: crypto.randomUUID(),
      basePrice: dto.basePrice,
      baseCurrency: dto.baseCurrency,
      changedAt: new Date(),
      updatedBy: sellerId,
      reason: dto.reason,
    });

    this.eventEmitter.emit('product.price.updated', {
      productId: product.id,
      sellerId,
      basePrice: product.basePrice,
      baseCurrency: product.baseCurrency,
      updatedAt: product.updatedAt,
    });

    return product;
  }

  async remove(id: string, sellerId: string) {
    const product = this.findOne(id);

    if (!product || product.sellerId !== sellerId) {
      throw new ForbiddenException('Not allowed to delete this product');
    }

    // Delete all associated images from storage and database
    try {
      await this.mediaService.deleteProductImages(id);
    } catch (error) {
      // Log error but don't prevent product deletion if image deletion fails
      console.error(`Failed to delete images for product ${id}:`, error);
    }

    this.products = this.products.filter((p) => p.id !== id);
    return { deleted: true };
  }

  private toDisplayProduct(
    product: Product,
    preferredCurrency?: SupportedCurrency,
  ) {
    const displayCurrency = preferredCurrency ?? product.baseCurrency;
    const convertedPrice = this.pricingService.convertAmount(
      product.basePrice,
      product.baseCurrency,
      displayCurrency,
    );
    const conversionRate = this.pricingService.getConversionRate(
      product.baseCurrency,
      displayCurrency,
    );

    return {
      ...product,
      convertedPrice,
      convertedCurrency: displayCurrency,
      conversionRate,
      displayPrice: `${displayCurrency} ${convertedPrice.toFixed(
        this.pricingService.getCurrencyPrecision(displayCurrency),
      )}`,
    };
  }
}
