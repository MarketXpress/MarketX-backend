import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  IsPositive,
  IsUrl,
  ArrayNotEmpty,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  category: string;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUrl({}, { each: true })
  images: string[];
}
