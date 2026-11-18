import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

/**
 * Toutes les requêtes sont filtrées par l'entreprise de l'utilisateur (déterminée par le serveur),
 * EN PLUS des règles RLS de Supabase : une défense en profondeur contre les accès entre entreprises.
 */
@Injectable()
export class EmployeesService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll(companyId: string, accessToken: string, status?: string) {
    const client = this.supabase.getClientForUser(accessToken);

    let query = client
      .from('employees')
      .select('*')
      .eq('company_id', companyId)
      .order('last_name', { ascending: true });

    if (status === 'active' || status === 'inactive') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async findOne(id: string, companyId: string, accessToken: string) {
    const client = this.supabase.getClientForUser(accessToken);
    const { data, error } = await client
      .from('employees')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Employé ${id} introuvable`);
    return data;
  }

  async create(dto: CreateEmployeeDto, companyId: string, accessToken: string) {
    const client = this.supabase.getClientForUser(accessToken);
    const { data, error } = await client
      .from('employees')
      .insert({ ...dto, company_id: companyId })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto,
    companyId: string,
    accessToken: string,
  ) {
    const client = this.supabase.getClientForUser(accessToken);
    const { data, error } = await client
      .from('employees')
      .update(dto)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Employé ${id} introuvable`);
    return data;
  }

  /** Désactivation logique : l'historique de paie est conservé. */
  async deactivate(id: string, companyId: string, accessToken: string) {
    const client = this.supabase.getClientForUser(accessToken);
    const { data, error } = await client
      .from('employees')
      .update({ status: 'inactive' })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Employé ${id} introuvable`);
    return { message: 'Employé désactivé', employee: data };
  }

  async deletePermanent(id: string, companyId: string, accessToken: string) {
    const client = this.supabase.getClientForUser(accessToken);
    const { data, error } = await client
      .from('employees')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId)
      .select('id');

    if (error) throw new InternalServerErrorException(error.message);
    if (!data || data.length === 0)
      throw new NotFoundException(`Employé ${id} introuvable`);
    return { message: 'Employé supprimé définitivement' };
  }
}
