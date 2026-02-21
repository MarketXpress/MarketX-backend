import { IsString, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ImageFormat } from '../entities/image.entity';

export class UploadImageDto {
  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(0)
  displayOrder?: number = 0;
}

export class ImageMetadataDto {
  @IsString()
  originalName: string;

  @IsString()
  mimeType: string;

  @IsNumber()
  size: number;

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;

  @IsEnum(ImageFormat)
  format: ImageFormat;
}

export class ReorderImagesDto {
  @IsString({ each: true })
  imageIds: string[];
}
