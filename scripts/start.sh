#!/bin/bash
set -e

echo ""
echo "🐾 =============================================="
echo "🐾  INTRACLAW — Starting..."
echo "🐾 =============================================="
echo ""

# Vérifie Docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker n'est pas installé. Visite https://docker.com"
  exit 1
fi

# Vérifie .env
if [ ! -f .env ]; then
  echo "⚠️  Pas de fichier .env trouvé."
  echo "👉 Lance d'abord : npm run setup"
  exit 1
fi

# Démarrage
echo "🚀 Démarrage des services..."
docker compose up -d

echo ""
echo "✅ IntraClaw démarré !"
echo "   → API    : http://localhost:3000"
echo "   → Health : http://localhost:3000/health"
echo ""
echo "📋 Logs : docker compose logs -f core"
