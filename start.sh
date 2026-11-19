#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=========================================================="
echo "  Iniciando Traductor Local (LibreTranslate EN ⇄ ES)"
echo "=========================================================="

# Crear carpeta de datos local para persistir los modelos descargados
mkdir -p "$DIR/data/libretranslate"
chmod -R 777 "$DIR/data/libretranslate" 2>/dev/null || true

# Iniciar los contenedores
docker compose up -d

echo ""
echo "Contenedores iniciados. Esperando a que LibreTranslate inicialice los modelos..."

# Esperar a que el backend responda en el endpoint /languages
READY=0
for i in {1..30}; do
  if curl -s http://localhost:5000/languages >/dev/null 2>&1; then
    READY=1
    break
  fi
  echo -n "."
  sleep 2
done
echo ""

if [ "$READY" -eq 1 ]; then
  echo "✅ LibreTranslate listo y funcionando."
  echo "🚀 Accede a tu interfaz web en: http://localhost:8080"
  echo "   Ejemplo URL con texto:"
  echo "   http://localhost:8080/?source=auto&target=smart_auto&q=Which+categories+do+they+fit%3F"
else
  echo "⏳ Los modelos se están descargando por primera vez. Puedes consultar el avance con:"
  echo "   docker logs -f libretranslate_backend"
  echo "   Una vez listo, abre en tu navegador: http://localhost:8080"
fi
