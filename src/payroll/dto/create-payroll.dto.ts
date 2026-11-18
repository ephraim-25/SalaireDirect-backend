import { IsNumber, IsInt, Min, Max, IsPositive } from 'class-validator';

/** L'entreprise est déterminée par le serveur à partir de l'utilisateur connecté (jamais par le client). */
export class CreatePayrollDto {
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
