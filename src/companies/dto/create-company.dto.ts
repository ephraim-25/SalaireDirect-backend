import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum CurrencyEnum {
  USD = 'USD',
  CDF = 'CDF',
}

export class CreateCompanyDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  nif?: string;

  @IsString()
  @IsOptional()
  cnss_number?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  logo_url?: string;

  @IsEnum(CurrencyEnum)
  @IsOptional()
  main_currency?: CurrencyEnum;
}
