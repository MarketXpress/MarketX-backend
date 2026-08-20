import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

import { Product as ProductEntity } from './entities/product.entity';

import {
  Product as ProductModel,
  ProductPriceHistoryEntry,
} from './interfaces/product.interface';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { UpdatePriceDto } from './dto/update-price.dto';

import { PricingService, SupportedCurrency } from './services/pricing.service';

import { ProductPriceEntity } from './entities/product-price.entity';

import { ProductPriceUpdatedEvent, EventNames } from '../common/events';

export interface PaginatedProducts {
  items: ProductModel[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly pricingService: PricingService,
    private readonly eventEmitter: EventEmitter2,

    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,

    @InjectRepository(ProductPriceEntity)
    private readonly priceHistoryRepo: Repository<ProductPriceEntity>,
  ) {}

  async create(sellerId: string, dto: CreateProductDto): Promise<ProductModel> {
    const basePrice = dto.basePrice ?? dto.price;

    const baseCurrency =
      dto.baseCurrency ?? dto.currency ?? SupportedCurrency.USD;

    if (basePrice === undefined) {
      throw new BadRequestException('Price is required.');
    }

    this.pricingService.validatePrice(basePrice, baseCurrency);

    const basePriceDecimal = basePrice.toString();

    const basePriceMinor = this.pricingService.toMinorUnitsString(
      basePrice,
      baseCurrency,
    );

    const rateSnapshot = this.pricingService.getRateSnapshot();

    const product = this.productRepo.create({
      id: crypto.randomUUID(),
      sellerId,
      name: dto.name,
      category: dto.category,
      basePrice: basePriceDecimal,
      basePriceMinor,
      baseCurrency,
      price: basePriceDecimal,
      priceMinor: basePriceMinor,
      currency: baseCurrency,
      description: dto.description,
      images: dto.images ?? [],
    });

    const savedProduct = await this.productRepo.save(product);

    await this.priceHistoryRepo.save(
      this.priceHistoryRepo.create({
        productId: savedProduct.id,
        basePrice: basePriceDecimal,
        basePriceMinor,
        baseCurrency,
        rateSnapshot: rateSnapshot.rates,
        rateTimestamp: rateSnapshot.timestamp
          ? new Date(rateSnapshot.timestamp)
          : undefined,
        updatedBy: sellerId,
        reason: 'initial_price',
      }),
    );

    return this.toProductModel(savedProduct, [
      {
        id: crypto.randomUUID(),
        basePrice: basePriceDecimal,
        basePriceMinor,
        baseCurrency,
        changedAt: savedProduct.createdAt,
        rateSnapshot: rateSnapshot.rates,
        rateTimestamp: rateSnapshot.timestamp,
        updatedBy: sellerId,
        reason: 'initial_price',
      },
    ]);
  }

  async findAll(filters: FilterProductDto): Promise<PaginatedProducts> {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      limit = 10,
      offset = 0,
      preferredCurrency,
    } = filters;

    const query = this.productRepo
      .createQueryBuilder('product')
      .orderBy('product.createdAt', 'DESC')
      .addOrderBy('product.id', 'DESC');

    if (search?.trim()) {
      query.andWhere('product.name ILIKE :search', {
        search: `%${search.trim()}%`,
      });
    }

    if (category?.trim()) {
      query.andWhere('product.category = :category', {
        category: category.trim(),
      });
    }

    if (minPrice !== undefined) {
      query.andWhere('product.basePrice >= :minPrice', {
        minPrice,
      });
    }

    if (maxPrice !== undefined) {
      query.andWhere('product.basePrice <= :maxPrice', {
        maxPrice,
      });
    }

    query.skip(offset).take(limit);

    const [products, total] = await query.getManyAndCount();

    const productIds = products.map((product) => product.id);

    const priceHistory =
      productIds.length > 0
        ? await this.priceHistoryRepo.find({
            where: productIds.map((productId) => ({
              productId,
            })),
            order: {
              createdAt: 'DESC',
            },
          })
        : [];

    const historyByProductId = new Map<string, ProductPriceEntity[]>();

    for (const history of priceHistory) {
      const existing = historyByProductId.get(history.productId) ?? [];

      existing.push(history);

      historyByProductId.set(history.productId, existing);
    }

    const items = products.map((product) =>
      this.toDisplayProduct(
        product,
        preferredCurrency,
        historyByProductId.get(product.id) ?? [],
      ),
    );

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  async findOne(
    id: string,
    preferredCurrency?: SupportedCurrency,
  ): Promise<ProductModel | undefined> {
    const product = await this.productRepo.findOne({
      where: {
        id,
      },
    });

    if (!product) {
      return undefined;
    }

    const priceHistory = await this.priceHistoryRepo.find({
      where: {
        productId: id,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return this.toDisplayProduct(product, preferredCurrency, priceHistory);
  }

  async update(
    id: string,
    sellerId: string,
    dto: UpdateProductDto,
  ): Promise<ProductModel> {
    const product = await this.productRepo.findOne({
      where: {
        id,
      },
    });

    if (!product || product.sellerId !== sellerId) {
      throw new ForbiddenException('Not allowed to update this product');
    }

    const { basePrice, baseCurrency, price, currency, ...rest } =
      dto as UpdateProductDto & {
        basePrice?: number;
        baseCurrency?: SupportedCurrency;
        currency?: SupportedCurrency;
      };

    const priceWasProvided =
      basePrice !== undefined ||
      baseCurrency !== undefined ||
      price !== undefined ||
      currency !== undefined;

    if (priceWasProvided) {
      await this.updatePrice(id, sellerId, {
        basePrice: basePrice ?? price ?? Number(product.basePrice),

        baseCurrency: baseCurrency ?? currency ?? product.baseCurrency,
      });

      const updatedProduct = await this.productRepo.findOne({
        where: {
          id,
        },
      });

      if (!updatedProduct) {
        throw new BadRequestException(
          'Product could not be reloaded after price update',
        );
      }

      Object.assign(updatedProduct, rest);

      const savedProduct = await this.productRepo.save(updatedProduct);

      return this.getProductModel(savedProduct);
    }

    Object.assign(product, rest);

    const savedProduct = await this.productRepo.save(product);

    return this.getProductModel(savedProduct);
  }

  async updatePrice(
    id: string,
    sellerId: string,
    dto: UpdatePriceDto,
  ): Promise<ProductModel> {
    const product = await this.productRepo.findOne({
      where: {
        id,
      },
    });

    if (!product || product.sellerId !== sellerId) {
      throw new ForbiddenException('Not allowed to update this product price');
    }

    this.pricingService.validatePrice(dto.basePrice, dto.baseCurrency);

    const basePriceDecimal = dto.basePrice.toString();

    const basePriceMinor = this.pricingService.toMinorUnitsString(
      dto.basePrice,
      dto.baseCurrency,
    );

    const hasChanged =
      product.basePrice !== basePriceDecimal ||
      product.baseCurrency !== dto.baseCurrency;

    if (!hasChanged) {
      return this.getProductModel(product);
    }

    const rateSnapshot = this.pricingService.getRateSnapshot();

    product.basePrice = basePriceDecimal;
    product.basePriceMinor = basePriceMinor;
    product.baseCurrency = dto.baseCurrency;

    product.price = basePriceDecimal;
    product.priceMinor = basePriceMinor;
    product.currency = dto.baseCurrency;

    const savedProduct = await this.productRepo.save(product);

    await this.priceHistoryRepo.save(
      this.priceHistoryRepo.create({
        productId: savedProduct.id,
        basePrice: basePriceDecimal,
        basePriceMinor,
        baseCurrency: dto.baseCurrency,
        rateSnapshot: rateSnapshot.rates,
        rateTimestamp: rateSnapshot.timestamp
          ? new Date(rateSnapshot.timestamp)
          : undefined,
        updatedBy: sellerId,
        reason: dto.reason,
      }),
    );

    this.eventEmitter.emit(
      EventNames.PRODUCT_PRICE_UPDATED,
      new ProductPriceUpdatedEvent(
        savedProduct.id,
        sellerId,
        savedProduct.basePrice,
        savedProduct.basePriceMinor,
        savedProduct.baseCurrency,
        rateSnapshot.rates,
        rateSnapshot.timestamp,
        savedProduct.updatedAt,
      ),
    );

    return this.getProductModel(savedProduct);
  }

  async getPriceHistory(productId: string): Promise<ProductPriceEntity[]> {
    return this.priceHistoryRepo.find({
      where: {
        productId,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async remove(id: string, userId: string): Promise<{ deleted: boolean }> {
    const product = await this.productRepo.findOne({
      where: {
        id,
      },
    });

    if (!product || product.sellerId !== userId) {
      throw new ForbiddenException('Not allowed to delete this product');
    }

    await this.productRepo.delete(id);

    return {
      deleted: true,
    };
  }

  private async getProductModel(product: ProductEntity): Promise<ProductModel> {
    const priceHistory = await this.priceHistoryRepo.find({
      where: {
        productId: product.id,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return this.toDisplayProduct(product, undefined, priceHistory);
  }

  private toProductModel(
    product: ProductEntity,
    priceHistory: ProductPriceHistoryEntry[] = [],
  ): ProductModel {
    return {
      id: product.id,
      sellerId: product.sellerId,
      name: product.name,
      category: product.category,

      basePrice: product.basePrice,
      basePriceMinor: product.basePriceMinor,
      baseCurrency: product.baseCurrency,

      price: product.price,
      priceMinor: product.priceMinor,
      currency: product.currency,

      description: product.description,
      images: product.images ?? [],

      createdAt: product.createdAt,
      updatedAt: product.updatedAt,

      priceHistory,
    };
  }

  private toDisplayProduct(
    product: ProductEntity,
    preferredCurrency?: SupportedCurrency,
    priceHistory: ProductPriceEntity[] = [],
  ): ProductModel {
    const displayCurrency = preferredCurrency ?? product.baseCurrency;

    const convertedPriceString = this.pricingService.convertAmountToString(
      product.basePrice,
      product.baseCurrency,
      displayCurrency,
    );

    const convertedPrice = Number(convertedPriceString);

    const conversionRate = this.pricingService.getConversionRate(
      product.baseCurrency,
      displayCurrency,
    );

    const history: ProductPriceHistoryEntry[] = priceHistory.map((entry) => ({
      id: entry.id,
      basePrice: String(entry.basePrice),
      basePriceMinor: entry.basePriceMinor,
      baseCurrency: entry.baseCurrency,
      changedAt: entry.createdAt,
      rateSnapshot: entry.rateSnapshot,
      rateTimestamp: entry.rateTimestamp?.toISOString(),
      updatedBy: entry.updatedBy,
      reason: entry.reason,
    }));

    return {
      ...this.toProductModel(product, history),

      convertedPrice,
      convertedPriceString,
      convertedCurrency: displayCurrency,
      conversionRate,
      displayPrice: `${displayCurrency} ${convertedPriceString}`,
    };
  }
}
