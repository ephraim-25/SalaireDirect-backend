import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly supabase: SupabaseService) {}

  async getDefaultCompanyId(accessToken: string): Promise<string> {
    const client = this.supabase.getClientForUser(accessToken);
    const { data } = await client.from('companies').select('id').limit(1).single();
    return data?.id || '00000000-0000-0000-0000-000000000001';
  }

  async findAll(companyId?: string, accessToken: string = 'dev-token', status?: string) {
    const client = this.supabase.getClientForUser(accessToken);

    let query = client
      .from('employees')
      .select('*')
      .order('last_name', { ascending: true });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    if (status) {
      query = query.eq('status', status as 'active' | 'inactive');
    }

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async findOne(id: string, accessToken: string = 'dev-token', companyId?: string) {
    const client = this.supabase.getClientForUser(accessToken);

    let query = client.from('employees').select('*').eq('id', id);

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query.single();

    if (error || !data) throw new NotFoundException(`Employé ${id} introuvable`);
    return data;
  }

  async create(dto: CreateEmployeeDto & { company_id?: string }, accessToken: string = 'dev-token', companyId?: string) {
    const client = this.supabase.getClientForUser(accessToken);

    const targetCompanyId = companyId || dto.company_id || (await this.getDefaultCompanyId(accessToken));

    const { data, error } = await client
      .from('employees')
      .insert({ ...dto, company_id: targetCompanyId })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto,
    accessToken: string = 'dev-token',
    companyId?: string,
  ) {
    const client = this.supabase.getClientForUser(accessToken);

    let query = client
      .from('employees')
      .update(dto)
      .eq('id', id);

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query.select().single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** Désactivation logique (soft delete) ou suppression */
  async deactivate(id: string, accessToken: string = 'dev-token', companyId?: string) {
    const client = this.supabase.getClientForUser(accessToken);

    let query = client
      .from('employees')
      .update({ status: 'inactive' })
      .eq('id', id);

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query.select().single();

    if (error) throw new InternalServerErrorException(error.message);
    return { message: 'Employé désactivé', employee: data };
  }

  async deletePermanent(id: string, accessToken: string = 'dev-token') {
    const client = this.supabase.getClientForUser(accessToken);
    const { error } = await client.from('employees').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
    return { message: 'Employé supprimé définitivement' };
  }
}
