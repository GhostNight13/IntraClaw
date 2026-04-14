#!/bin/bash
set -e
echo "🔄 Mise à jour d'IntraClaw..."
git pull origin main
docker compose pull
docker compose up -d --build
echo "✅ IntraClaw mis à jour !"
