#!/usr/bin/env bash
# Script para generar e instalar el certificado de la Autoridad Certificadora (CA) Local
# en el sistema y en el navegador para que https://translate.local sea 100% de confianza.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$SCRIPT_DIR/data/certs"
CA_CERT="$CERTS_DIR/localCA.crt"
CA_KEY="$CERTS_DIR/localCA.key"
CERT_PEM="$CERTS_DIR/cert.pem"
KEY_PEM="$CERTS_DIR/key.pem"

mkdir -p "$CERTS_DIR"

# 0. Si no existen los certificados, generarlos automáticamente
if [ ! -f "$CA_CERT" ] || [ ! -f "$CERT_PEM" ] || [ ! -f "$KEY_PEM" ]; then
    echo " Generando certificados SSL y Autoridad Certificadora (CA) local..."
    openssl genrsa -out "$CA_KEY" 2048
    openssl req -x509 -new -nodes -key "$CA_KEY" -sha256 -days 3650 \
      -out "$CA_CERT" -subj "/CN=Traductor Local Root CA/O=Merke.net/OU=Desarrollo/C=MX"

    openssl genrsa -out "$KEY_PEM" 2048
    openssl req -new -key "$KEY_PEM" -out "$CERTS_DIR/server.csr" \
      -subj "/CN=translate.local/O=Merke.net/OU=Desarrollo/C=MX"

    cat <<EOF > "$CERTS_DIR/server.ext"
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = translate.local
DNS.2 = localhost
DNS.3 = translate
IP.1 = 127.0.0.1
EOF

    openssl x509 -req -in "$CERTS_DIR/server.csr" -CA "$CA_CERT" -CAkey "$CA_KEY" -CAcreateserial \
      -out "$CERT_PEM" -days 3650 -sha256 -extfile "$CERTS_DIR/server.ext"

    rm -f "$CERTS_DIR/server.csr" "$CERTS_DIR/server.ext"
    echo " Certificados generados en $CERTS_DIR"
fi

echo "=========================================================="
echo " Instalador de Certificado Local para https://translate.local"
echo "=========================================================="

# 1. Instalar en el almacén de certificados del sistema (Ubuntu/Debian)
echo ""
echo "[1/2] Instalando certificado en el almacén del sistema..."
sudo cp "$CA_CERT" /usr/local/share/ca-certificates/translate_local_ca.crt
sudo update-ca-certificates

# 2. Instalar en la base de datos NSS de Chrome / Chromium si certutil está disponible
echo ""
echo "[2/2] Configurando confianza para navegadores basados en Chromium..."
if ! command -v certutil &> /dev/null; then
    echo "ℹ️  'certutil' no está instalado. Instalándolo para configurar Chrome automáticamente..."
    sudo apt-get update -qq && sudo apt-get install -y libnss3-tools -qq
fi

if command -v certutil &> /dev/null; then
    NSS_DIR="$HOME/.pki/nssdb"
    if [ -d "$NSS_DIR" ]; then
        # Eliminar versión anterior si existía
        certutil -D -d sql:"$NSS_DIR" -n "Traductor Local Root CA" 2>/dev/null || true
        # Agregar nueva CA con permisos de confianza
        certutil -d sql:"$NSS_DIR" -A -t "C,," -n "Traductor Local Root CA" -i "$CA_CERT"
        echo " Certificado agregado con éxito a Chrome/Chromium ($NSS_DIR)."
    fi
fi

echo ""
echo "=========================================================="
echo " ¡Listo! https://translate.local ahora es de confianza."
echo " Reinicia tu navegador si lo tenías abierto."
echo "=========================================================="
