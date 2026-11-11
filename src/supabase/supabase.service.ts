import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';

/**
 * Service Supabase - Fournit deux clients :
 * - client: client anon
 * - adminClient: client avec service_role ou anon key
 */
@Injectable()
export class SupabaseService {
  private readonly _client: SupabaseClient<Database>;
  private readonly _adminClient: SupabaseClient<Database>;

  constructor() {
    const url = process.env.SUPABASE_URL || 'https://szxgouaihkxuomfguxbz.supabase.co';
    const anonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6eGdvdWFpaGt4dW9tZmd1eGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxMTY4NTAsImV4cCI6MjEwOTY5Mjg1MH0.5aoQbpl2bQOBDsbDj2TnQ2SrhBIM1cok4Ae_nFbAyhs';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey;

    this._client = createClient<Database>(url, anonKey, {
      auth: { persistSession: false },
    });

    this._adminClient = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  /**
   * Retourne un client Supabase adapté.
   * Si un vrai JWT Supabase valide (3 parties) est fourni, il est injecté.
   * Sinon, utilise le client configuré.
   */
  getClientForUser(accessToken?: string): SupabaseClient<Database> {
    if (!accessToken || typeof accessToken !== 'string' || accessToken.split('.').length !== 3) {
      return this._client;
    }

    return createClient<Database>(
      process.env.SUPABASE_URL || 'https://szxgouaihkxuomfguxbz.supabase.co',
      process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6eGdvdWFpaGt4dW9tZmd1eGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxMTY4NTAsImV4cCI6MjEwOTY5Mjg1MH0.5aoQbpl2bQOBDsbDj2TnQ2SrhBIM1cok4Ae_nFbAyhs',
      {
        auth: { persistSession: false },
        global: {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      },
    );
  }

  /**
   * Client admin - Bypass RLS si service_role key configuré.
   */
  get adminClient(): SupabaseClient<Database> {
    return this._adminClient;
  }
}
