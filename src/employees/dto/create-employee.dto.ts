import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDate,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum MobileMoneyOperator {
  M_PESA = 'M-Pesa',
  ORANGE_MONEY = 'Orange Money',
  AIRTEL_MONEY = 'Airtel Money',
}

export enum EmployeeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum CurrencyEnum {
  USD = 'USD',
  CDF = 'CDF',
}

export class CreateEmployeeDto {
  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsDateString()
  @IsOptional()
  hire_date?: string;

  @IsString()
  @IsOptional()
  cnss_number?: string;

  @IsNumber()
  @Min(0)
  base_salary: number;

  @IsEnum(CurrencyEnum)
  @IsOptional()
  salary_currency?: CurrencyEnum;

  @IsString()
  @IsOptional()
  mobile_money_number?: string;

  @IsEnum(MobileMoneyOperator)
  @IsOptional()
  mobile_money_operator?: MobileMoneyOperator;

  @IsString()
  @IsOptional()
  whatsapp_number?: string;

  @IsString()
  @IsOptional()
  marital_status?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  dependent_children?: number;

  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;
}
