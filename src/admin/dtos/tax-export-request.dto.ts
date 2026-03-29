import { IsDateString, IsEmail, IsUUID } from 'class-validator';

export class TaxExportRequestDto {
  @IsUUID()
  sellerId: string;

  @IsEmail()
  sellerEmail: string;

  /** ISO-8601 date string, e.g. "2020-01-01" */
  @IsDateString()
  startDate: string;

  /** ISO-8601 date string, e.g. "2024-12-31" */
  @IsDateString()
  endDate: string;
}
