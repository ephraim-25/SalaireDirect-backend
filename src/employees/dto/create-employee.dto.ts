import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsNotEmpty,
  IsDateString,
} from 'class-validator';

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
  @IsNotEmpty()
  @MaxLength(100)
  first_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  last_name: string;

  @IsString()
  @MaxLength(150)
  @IsOptional()
  position?: string;

  @IsDateString()
  @IsOptional()
  hire_date?: string;

  @IsString()
  @IsOptional()
  cnss_number?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
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
  @Max(20)
  @IsOptional()
  dependent_children?: number;

  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;
}
