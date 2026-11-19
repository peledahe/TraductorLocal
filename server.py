#!/usr/bin/env python3
"""
Servidor Web y Proxy Inverso para Traductor Local (LibreTranslate)
Sirve la interfaz estática desde ./web y redirige llamadas de API al backend.
No requiere dependencias externas (utiliza únicamente la biblioteca estándar de Python).
"""

import http.server
import json
import os
import socketserver
import ssl
import sys
import threading
import urllib.error
import urllib.request

PORT = int(os.environ.get("PORT", 8080))
SSL_PORT = int(os.environ.get("SSL_PORT", 8443))
LIBRETRANSLATE_HOST = os.environ.get("LIBRETRANSLATE_HOST", "http://127.0.0.1:5000")
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
CERTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "certs")

class TranslationProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        # Rutas de la API de LibreTranslate que queremos proxear
        if self.path.startswith(("/languages", "/frontend/", "/download_file/")):
            self.proxy_request("GET")
        else:
            super().do_GET()

    def do_POST(self):
        # Rutas POST de la API
        if self.path.startswith(("/translate", "/detect", "/suggest", "/translate_file")):
            self.proxy_request("POST")
        else:
            self.send_error(404, "Endpoint no encontrado")

    def proxy_request(self, method):
        target_url = f"{LIBRETRANSLATE_HOST.rstrip('/')}{self.path}"

        headers = {}
        for key, val in self.headers.items():
            if key.lower() not in ["host", "content-length"]:
                headers[key] = val

        data = None
        if method == "POST":
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length > 0:
                data = self.rfile.read(content_length)

        req = urllib.request.Request(
            target_url,
            data=data,
            headers=headers,
            method=method
        )

        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                self.send_response(resp.status)
                resp_data = resp.read()

                # Si es JSON y contiene translatedFileUrl, normalizamos a ruta local /download_file/
                content_type = resp.headers.get("Content-Type", "")
                if "application/json" in content_type:
                    try:
                        parsed = json.loads(resp_data.decode("utf-8"))
                        if "translatedFileUrl" in parsed and "/download_file/" in parsed["translatedFileUrl"]:
                            file_part = parsed["translatedFileUrl"].split("/download_file/")[-1]
                            parsed["translatedFileUrl"] = f"/download_file/{file_part}"
                            resp_data = json.dumps(parsed).encode("utf-8")
                    except Exception:
                        pass

                for header, value in resp.getheaders():
                    if header.lower() not in ["transfer-encoding", "content-length"]:
                        self.send_header(header, value)

                self.send_header("Content-Length", str(len(resp_data)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(resp_data)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            for header, value in e.headers.items():
                if header.lower() not in ["transfer-encoding", "content-length"]:
                    self.send_header(header, value)
            err_data = e.read()
            self.send_header("Content-Length", str(len(err_data)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(err_data)
        except Exception as err:
            self.send_response(502)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            err_payload = json.dumps({
                "error": f"No se pudo conectar con LibreTranslate en {LIBRETRANSLATE_HOST}: {str(err)}"
            }).encode("utf-8")
            self.wfile.write(err_payload)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()


def run_http_server(port):
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), TranslationProxyHandler) as httpd:
        print(f" Servidor HTTP activo en: http://0.0.0.0:{port}")
        sys.stdout.flush()
        httpd.serve_forever()

def run_https_server(port, certfile, keyfile):
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), TranslationProxyHandler) as httpd:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(certfile=certfile, keyfile=keyfile)
        httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
        print(f" Servidor HTTPS activo en: https://0.0.0.0:{port}")
        sys.stdout.flush()
        httpd.serve_forever()

def run_server():
    cert_file = os.path.join(CERTS_DIR, "cert.pem")
    key_file = os.path.join(CERTS_DIR, "key.pem")

    print(f"==================================================")
    print(f" Traductor Local iniciando...")
    print(f" Conectado a LibreTranslate en: {LIBRETRANSLATE_HOST}")
    print(f"==================================================")

    # Iniciar HTTPS en segundo plano si los certificados existen
    if os.path.exists(cert_file) and os.path.exists(key_file):
        https_thread = threading.Thread(
            target=run_https_server,
            args=(SSL_PORT, cert_file, key_file),
            daemon=True
        )
        https_thread.start()

    # Ejecutar HTTP en el hilo principal
    run_http_server(PORT)

if __name__ == "__main__":
    run_server()
