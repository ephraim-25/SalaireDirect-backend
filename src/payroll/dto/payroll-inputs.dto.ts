import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const MAX_AMOUNT = 1_000_000_000;

/**
 * Variables saisies pour un salarié. Le salaire de base, la devise et les enfants à charge
 * sont lus en base de données : tout autre champ envoyé par le client est ignoré.
 */
export class PayrollEntryDto {
  @IsUUID()
  employeeId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_AMOUNT)
  primes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_AMOUNT)
  overtime?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_AMOUNT)
  absences?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_AMOUNT)
  advances?: number;
}

class PayrollPeriodDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  /** Taux du mois : 1 USD = X CDF (obligatoire, aucune valeur par défaut). */
  @IsNumber()
  @IsPositive()
  @Max(1_000_000)
  usd_cdf_rate: number;
}

export class CalculatePayrollDto extends PayrollPeriodDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => PayrollEntryDto)
  employees: PayrollEntryDto[];
}

export class SaveMonthDto extends PayrollPeriodDto {
  @IsOptional()
  @IsEnum(['draft', 'closed'])
  status?: 'draft' | 'closed';

  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => PayrollEntryDto)
  calculations: PayrollEntryDto[];
}

export enum VariableType {
  PRIME = 'prime',
  HEURES_SUP = 'heures_sup',
  ABSENCE = 'absence',
  AVANCE = 'avance',
}

export class CreateVariableDto {
  @IsUUID()
  employee_id: string;

  @IsEnum(VariableType)
  type: VariableType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_AMOUNT)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000)
  quantity?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;
}
