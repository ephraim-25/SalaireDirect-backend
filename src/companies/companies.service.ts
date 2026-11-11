import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Récupère toutes les entreprises de l'utilisateur (via RLS) */
  async findAll(userId: string, accessToken: string) {
    const client = this.supabase.getClientForUser(accessToken);

    const { data, error } = await client
      .from('companies')
      .select(`
        *,
        company_users!inner(role)
      `)
      .eq('company_users.user_id', userId);

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** Récupère une entreprise par ID */
  async findOne(id: string, accessToken: string) {
    const client = this.supabase.getClientForUser(accessToken);

    const { data, error } = await client
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new NotFoundException(`Entreprise ${id} introuvable`);
    return data;
  }

  /** Crée une entreprise et affecte le créateur comme admin */
  async create(dto: CreateCompanyDto, userId: string, accessToken: string) {
    const client = this.supabase.getClientForUser(accessToken);

    // Créer l'entreprise
    const { data: company, error: companyError } = await client
      .from('companies')
      .insert(dto)
      .select()
      .single();

    if (companyError) {
      throw new InternalServerErrorException(companyError.message);
    }

    // Affecter le créateur comme admin via le client admin (bypass RLS pour l'insert initial)
    const { error: memberError } = await this.supabase.adminClient
      .from('company_users')
      .insert({
        user_id: userId,
        company_id: company.id,
        role: 'admin',
      });

    if (memberError) {
      // Rollback: supprimer l'entreprise créée
      await this.supabase.adminClient
        .from('companies')
        .delete()
        .eq('id', company.id);
      throw new InternalServerErrorException(
        `Erreur lors de l'affectation admin: ${memberError.message}`,
      );
    }

    return company;
  }

  /** Met à jour une entreprise */
  async update(id: string, dto: UpdateCompanyDto, accessToken: string) {
    const client = this.supabase.getClientForUser(accessToken);

    const { data, error } = await client
      .from('companies')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }
}
