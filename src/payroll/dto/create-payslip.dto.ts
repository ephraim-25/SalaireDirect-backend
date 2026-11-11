import { IsUUID, IsNumber, IsOptional, Min } from 'class-validator';

export class CreatePayslipDto {
  @IsUUID()
  employee_id: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  base_salary?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  bonuses?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  overtime?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  absences_deductions?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  advances?: number;
}
