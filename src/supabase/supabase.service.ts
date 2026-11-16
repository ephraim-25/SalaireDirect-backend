import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Renseignez-la (voir .env.example) avant de démarrer le serveur.`,
    );
  }
  return value;
}

/**
 * Service Supabase - Fournit trois types de clients :
 * - client : clé « anon », sans utilisateur (vérification des jetons uniquement)
 * - getClientForUser(token) : clé « anon » + jeton de l'utilisateur => les règles RLS s'appliquent
 * - adminClient : clé « service_role » (contourne la RLS) — à n'utiliser que côté serveur,
 *   après avoir vérifié l'identité de l'utilisateur.
 */
@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly url: string;
  private readonly anonKey: string;
  private readonly _client: SupabaseClient<Database>;
  private readonly _adminClient: SupabaseClient<Database> | null;

  constructor() {
    // Plus aucune valeur par défaut codée en dur : le serveur refuse de démarrer si la config manque.
    this.url = requireEnv('SUPABASE_URL');
    this.anonKey = requireEnv('SUPABASE_ANON_KEY');

    this._client = createClient<Database>(this.url, this.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey && !serviceRoleKey.startsWith('YOUR_')) {
      this._adminClient = createClient<Database>(this.url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } else {
      this._adminClient = null;
      this.logger.warn(
        "SUPABASE_SERVICE_ROLE_KEY absente : les opérations d'administration (création automatique d'entreprise) sont désactivées.",
      );
    }
  }

  /** Client sans utilisateur : sert uniquement à vérifier un jeton (auth.getUser). */
  get client(): SupabaseClient<Database> {
    return this._client;
  }

  /**
   * Client agissant AU NOM de l'utilisateur : le jeton est transmis à Supabase,
   * donc les politiques RLS s'appliquent. Un jeton est obligatoire.
   */
  getClientForUser(accessToken?: string): SupabaseClient<Database> {
    if (!accessToken || accessToken.split('.').length !== 3) {
      throw new UnauthorizedException('Session invalide ou expirée.');
    }

    return createClient<Database>(this.url, this.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
  }

  /** Client administrateur (service_role). Renvoie null s'il n'est pas configuré. */
  get adminClient(): SupabaseClient<Database> | null {
    return this._adminClient;
  }
}
