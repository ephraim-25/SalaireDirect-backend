import {
  IsString,
  IsNumber,
  IsInt,
  IsUUID,
  Min,
  Max,
  IsPositive,
} from 'class-validator';

export class CreatePayrollDto {
  @IsUUID()
  company_id: string;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsNumber()
  @IsPositive()
  usd_cdf_rate: number;
}
