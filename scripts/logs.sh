#!/bin/bash
SERVICE=${1:-core}
echo "📋 Logs du service: $SERVICE"
docker compose logs -f "$SERVICE"
