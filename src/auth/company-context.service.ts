import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface CompanyContext {
  companyId: string;
  role: 'admin' | 'accountant';
}

/**
 * Détermine l'entreprise (et le rôle) d'un utilisateur DÉJÀ authentifié.
 * Si l'utilisateur n'en a pas encore (première connexion après inscription),
 * l'entreprise est créée à partir du nom saisi à l'inscription.
 */
@Injectable()
export class CompanyContextService {
  private readonly logger = new Logger(CompanyContextService.name);
  // Évite de créer deux entreprises si plusieurs requêtes arrivent en parallèle à la première connexion.
  private readonly provisioning = new Map<string, Promise<CompanyContext>>();

  constructor(private readonly supabase: SupabaseService) {}

  async resolve(
    user: { id: string; user_metadata?: Record<string, unknown> },
    accessToken: string,
  ): Promise<CompanyContext> {
    const existing = await this.findMembership(user.id, accessToken);
    if (existing) return existing;

    let pending = this.provisioning.get(user.id);
    if (!pending) {
      pending = this.provision(user).finally(() =>
        this.provisioning.delete(user.id),
      );
      this.provisioning.set(user.id, pending);
    }
    return pending;
  }

  private async findMembership(
    userId: string,
    accessToken: string,
  ): Promise<CompanyContext | null> {
    // 1) Avec le jeton de l'utilisateur (RLS) ; 2) à défaut avec le client admin, filtré sur l'identité VÉRIFIÉE.
    const clients = [
      this.supabase.getClientForUser(accessToken),
      this.supabase.adminClient,
    ].filter((c): c is NonNullable<typeof c> => c !== null);

    for (const client of clients) {
      const { data } = await client
        .from('company_users')
        .select('company_id, role, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1);

      if (data && data.length > 0) {
        return { companyId: data[0].company_id, role: data[0].role };
      }
    }
    return null;
  }

  private async provision(user: {
    id: string;
    user_metadata?: Record<string, unknown>;
  }): Promise<CompanyContext> {
    const admin = this.supabase.adminClient;
    if (!admin) {
      throw new ForbiddenException(
        "Aucune entreprise n'est associée à ce compte. Contactez le support.",
      );
    }

    const metaName = user.user_metadata?.company_name;
    const name =
      typeof metaName === 'string' && metaName.trim()
        ? metaName.trim().slice(0, 150)
        : 'Mon entreprise';

    const { data: company, error } = await admin
      .from('companies')
      .insert({ name })
      .select('id')
      .single();
    if (error || !company) {
      this.logger.error(
        `Création d'entreprise impossible pour ${user.id}: ${error?.message}`,
      );
      throw new ForbiddenException(
        "Impossible de créer l'entreprise de ce compte.",
      );
    }

    const { error: linkError } = await admin
      .from('company_users')
      .insert({ company_id: company.id, user_id: user.id, role: 'admin' });

    if (linkError) {
      await admin.from('companies').delete().eq('id', company.id);
      this.logger.error(
        `Rattachement impossible pour ${user.id}: ${linkError.message}`,
      );
      throw new ForbiddenException(
        'Impossible de rattacher ce compte à son entreprise.',
      );
    }

    this.logger.log(
      `Entreprise « ${name} » créée pour l'utilisateur ${user.id}`,
    );
    return { companyId: company.id, role: 'admin' };
  }
}
