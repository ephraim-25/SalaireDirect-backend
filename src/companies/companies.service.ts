import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Un utilisateur n'accède qu'à SON entreprise : tout autre identifiant renvoie 404. */
  async findOne(id: string, ownCompanyId: string, accessToken: string) {
    if (id !== ownCompanyId)
      throw new NotFoundException(`Entreprise ${id} introuvable`);

    const client = this.supabase.getClientForUser(accessToken);
    const { data, error } = await client
      .from('companies')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Entreprise ${id} introuvable`);
    return data;
  }

  async update(
    id: string,
    dto: UpdateCompanyDto,
    ownCompanyId: string,
    accessToken: string,
  ) {
    if (id !== ownCompanyId)
      throw new NotFoundException(`Entreprise ${id} introuvable`);

    const client = this.supabase.getClientForUser(accessToken);
    const { data, error } = await client
      .from('companies')
      .update(dto)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Entreprise ${id} introuvable`);
    return data;
  }
}
