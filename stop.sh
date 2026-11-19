#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "Deteniendo Traductor Local..."
docker compose down
echo "Servicio detenido correctamente."
