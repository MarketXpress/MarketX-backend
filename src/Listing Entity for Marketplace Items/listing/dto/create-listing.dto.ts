import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  MaxLength,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateListingDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  description: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string = 'USD';

  @IsString()
  @MaxLength(255)
  location: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsUUID()
  userId: string;
}
