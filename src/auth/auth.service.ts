import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

const TRIAL_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Profil de l'utilisateur connecté et état de son essai gratuit. */
  async getMe(
    user: { id: string; email?: string },
    companyId: string,
    accessToken: string,
  ) {
    const client = this.supabase.getClientForUser(accessToken);
    const { data: company } = await client
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (!company) throw new NotFoundException('Entreprise introuvable.');

    const trialEnd = new Date(
      new Date(company.created_at).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
    );
    const daysLeft = Math.max(
      0,
      Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
    );

    return {
      user: { id: user.id, email: user.email },
      company: {
        ...company,
        trialExpiresAt: trialEnd.toISOString(),
        trialDaysRemaining: daysLeft,
      },
    };
  }
}
