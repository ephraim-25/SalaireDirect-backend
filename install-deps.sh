#!/bin/bash
# Script d'installation des dépendances supplémentaires SalaireDirect
# Exécuter depuis le dossier backend/

echo "📦 Installation des dépendances SalaireDirect Backend..."

# Dépendances de production
npm install \
  @supabase/supabase-js \
  @nestjs/config \
  @nestjs/mapped-types \
  class-validator \
  class-transformer \
  pdfkit \
  @types/pdfkit

echo "✅ Dépendances installées avec succès!"
echo ""
echo "📋 Prochaines étapes:"
echo "  1. Copiez .env.example en .env"
echo "  2. Renseignez SUPABASE_SERVICE_ROLE_KEY depuis le Dashboard Supabase"
echo "  3. Lancez: npm run start:dev"
