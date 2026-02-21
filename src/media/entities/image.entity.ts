import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ImageFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
}

export interface ImageVariant {
  url: string;
  width: number;
  height: number;
  size: number;
}

export interface ImageVariants {
  thumbnail: ImageVariant;
  medium: ImageVariant;
  original: ImageVariant;
}

@Entity('product_images')
@Index(['productId'])
@Index(['productId', 'displayOrder'])
export class ProductImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  productId: string;

  @Column({ type: 'varchar', length: 255 })
  originalName: string;

  @Column({ type: 'enum', enum: ImageFormat })
  format: ImageFormat;

  @Column({ type: 'varchar', length: 50 })
  mimeType: string;

  @Column({ type: 'int' })
  originalWidth: number;

  @Column({ type: 'int' })
  originalHeight: number;

  @Column({ type: 'int' })
  originalSize: number;

  @Column({ type: 'jsonb' })
  variants: ImageVariants;

  @Column({ type: 'varchar', length: 500, nullable: true })
  altText?: string;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({ type: 'varchar', length: 500 })
  storageKey: string;

  @Column({ type: 'varchar', length: 100 })
  storageProvider: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper method to get the appropriate image URL based on size requirement
  getUrl(size: 'thumbnail' | 'medium' | 'original' = 'original'): string {
    return this.variants[size]?.url || this.variants.original.url;
  }

  // Helper method to get all URLs as an array
  getAllUrls(): string[] {
    return [
      this.variants.thumbnail.url,
      this.variants.medium.url,
      this.variants.original.url,
    ];
  }
}
