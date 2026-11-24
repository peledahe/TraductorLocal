#!/usr/bin/env python3
"""
Servidor Web y Proxy Inverso para Traductor Local (LibreTranslate)
Sirve la interfaz estática desde ./web, redirige llamadas de API al backend
y gestiona el refinamiento de traducciones mediante APIs de IA (Gemini, Claude, ChatGPT, DeepSeek).
No requiere dependencias externas (utiliza únicamente la biblioteca estándar de Python).
"""

import email
from email.policy import default
import http.server
import io
import json
import mimetypes
import os
import socketserver
import ssl
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
import zipfile

PORT = int(os.environ.get("PORT", 8080))
SSL_PORT = int(os.environ.get("SSL_PORT", 8443))
LIBRETRANSLATE_HOST = os.environ.get("LIBRETRANSLATE_HOST", "http://127.0.0.1:5000")
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
CERTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "certs")
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "ai_config.json")

# Claves del sistema / cuota gratuita gestionada por el servidor
SYSTEM_KEYS = {
    "gemini": os.environ.get("SYSTEM_GEMINI_API_KEY", "").strip(),
    "claude": os.environ.get("SYSTEM_CLAUDE_API_KEY", "").strip(),
    "chatgpt": os.environ.get("SYSTEM_CHATGPT_API_KEY", "").strip(),
    "deepseek": os.environ.get("SYSTEM_DEEPSEEK_API_KEY", "").strip(),
    "meta": os.environ.get("SYSTEM_META_API_KEY", os.environ.get("SYSTEM_GROQ_API_KEY", "")).strip()
}

# Control y límite de cuota gratuita por IP (sliding window)
FREE_QUOTA_TRACKER = {}  # { client_ip: [timestamp1, timestamp2, ...] }
FREE_QUOTA_LIMIT_PER_MINUTE = 30
FREE_QUOTA_LIMIT_PER_DAY = 150

def get_system_key(provider):
    """
    Obtiene la clave de sistema / cuota gratuita disponible en el servidor.
    Revisa variables de entorno y como respaldo el archivo de configuración del servidor.
    """
    prov = provider.lower().strip()
    key = SYSTEM_KEYS.get(prov, "")
    if key:
        return key

    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                if prov in cfg and cfg[prov].get("apiKey"):
                    return cfg[prov]["apiKey"].strip()
        except Exception:
            pass
    return ""

def check_and_record_free_quota(client_ip):
    """
    Valida y registra el uso de cuota gratuita por IP para evitar abuso.
    Retorna (permitido: bool, mensaje: str, restantes_hoy: int).
    """
    now = time.time()
    one_day_ago = now - 86400
    one_minute_ago = now - 60

    history = FREE_QUOTA_TRACKER.get(client_ip, [])
    # Limpiar registros más antiguos a 24 horas
    history = [t for t in history if t > one_day_ago]

    # Verificar límite por minuto
    min_requests = sum(1 for t in history if t > one_minute_ago)
    if min_requests >= FREE_QUOTA_LIMIT_PER_MINUTE:
        return False, "Has alcanzado el límite por minuto de la cuota gratuita (máx. 30 peticiones/min). Por favor espera un momento o ingresa tu propia API Key.", 0

    # Verificar límite diario
    if len(history) >= FREE_QUOTA_LIMIT_PER_DAY:
        return False, f"Has alcanzado el límite diario de la cuota gratuita ({FREE_QUOTA_LIMIT_PER_DAY}/{FREE_QUOTA_LIMIT_PER_DAY}). Ingresa tu propia API Key personal para continuar sin límites.", 0

    history.append(now)
    FREE_QUOTA_TRACKER[client_ip] = history
    remaining = max(0, FREE_QUOTA_LIMIT_PER_DAY - len(history))
    return True, "OK", remaining


def call_ai_provider(provider, api_key, model, system_prompt, user_prompt, image_data=None):
    """
    Llama de manera estándar y segura a la API de la IA seleccionada
    (Gemini, Claude, ChatGPT, DeepSeek) sin dependencias externas.
    Soporta texto e imágenes (multimodal) para interpretar capturas y optimizar prompts.
    """
    provider = provider.lower().strip()

    # 1. Google Gemini
    if provider == "gemini":
        model_name = (model or "gemini-3.5-flash-lite").replace("models/", "").strip()
        parts = []
        if image_data:
            mime_type = "image/png"
            b64_data = image_data
            if "," in image_data:
                header, b64_data = image_data.split(",", 1)
                if "data:" in header and ";base64" in header:
                    mime_type = header.split(";")[0].replace("data:", "").strip()
            parts.append({
                "inlineData": {
                    "mimeType": mime_type,
                    "data": b64_data
                }
            })
        parts.append({"text": f"{system_prompt}\n\n{user_prompt}"})

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": parts
                }
            ],
            "generationConfig": {
                "temperature": 0.2
            }
        }
        
        last_error = None
        # Probar primero el modelo seleccionado; si está discontinuado o da 404/503, intentar con modelos compatibles
        models_to_try = [model_name]
        for fallback in ["gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.8-flash", "gemini-3.5-flash"]:
            if fallback not in models_to_try:
                models_to_try.append(fallback)

        for m in models_to_try:
            for ver in ["v1beta", "v1"]:
                url = f"https://generativelanguage.googleapis.com/{ver}/models/{m}:generateContent?key={api_key}"
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "Content-Type": "application/json",
                        "x-goog-api-key": api_key
                    },
                    method="POST"
                )
                try:
                    with urllib.request.urlopen(req, timeout=35) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                        candidates = data.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            res_parts = candidates[0]["content"].get("parts", [])
                            if res_parts and "text" in res_parts[0]:
                                return res_parts[0]["text"]
                        raise Exception("No se recibió texto generado de Gemini")
                except urllib.error.HTTPError as e:
                    last_error = e
                    # 404 = modelo no disponible en esa versión/cuenta, 503 = sobrecarga temporal -> intentar siguiente
                    if e.code in (404, 503):
                        continue
                    # Errores 400/401/403 (clave inválida, cuota, etc.) lanzar de inmediato
                    raise e
                except Exception as e:
                    last_error = e
                    continue

        if last_error:
            raise last_error
        raise Exception("No fue posible comunicarse con los modelos de Gemini")

    # 2. Anthropic Claude
    elif provider == "claude":
        # claude-3-5-haiku-20241022 es el modelo de menor costo de tokens con visión
        model_name = model or "claude-3-5-haiku-20241022"
        url = "https://api.anthropic.com/v1/messages"
        user_content = []
        if image_data:
            mime_type = "image/png"
            b64_data = image_data
            if "," in image_data:
                header, b64_data = image_data.split(",", 1)
                if "data:" in header and ";base64" in header:
                    mime_type = header.split(";")[0].replace("data:", "").strip()
            user_content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": mime_type,
                    "data": b64_data
                }
            })
        user_content.append({"type": "text", "text": user_prompt})

        payload = {
            "model": model_name,
            "max_tokens": 4096,
            "temperature": 0.2,
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": user_content}
            ]
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=35) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            content = data.get("content", [])
            if content and "text" in content[0]:
                return content[0]["text"]
            raise Exception("No se recibió contenido de Claude")

    # 3. OpenAI ChatGPT
    elif provider in ("chatgpt", "openai"):
        model_name = model or "gpt-4o-mini"
        if image_data and "3.5" in model_name:
            # gpt-3.5-turbo no soporta visión -> auto actualizar a gpt-4o-mini
            model_name = "gpt-4o-mini"

        url = "https://api.openai.com/v1/chat/completions"
        user_content = []
        if image_data:
            img_url = image_data if image_data.startswith("data:") else f"data:image/png;base64,{image_data}"
            user_content.append({
                "type": "image_url",
                "image_url": {
                    "url": img_url,
                    "detail": "low"  # Menor consumo de tokens posible (~85 tokens)
                }
            })
        user_content.append({"type": "text", "text": user_prompt})

        payload = {
            "model": model_name,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ]
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "TraductorLocal/1.0"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=35) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            choices = data.get("choices", [])
            if choices and "message" in choices[0]:
                return choices[0]["message"].get("content", "")
            raise Exception("No se recibió contenido de OpenAI")

    # 4. DeepSeek
    elif provider == "deepseek":
        if image_data:
            raise Exception("DeepSeek no soporta procesamiento de imágenes/visión en su API de chat. Por favor selecciona Google Gemini (gemini-3.5-flash-lite) o ChatGPT (gpt-4o-mini) para interpretar imágenes.")

        model_name = model or "deepseek-chat"
        url = "https://api.deepseek.com/chat/completions"
        payload = {
            "model": model_name,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "TraductorLocal/1.0"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=35) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            choices = data.get("choices", [])
            if choices and "message" in choices[0]:
                return choices[0]["message"].get("content", "")
            raise Exception("No se recibió contenido de DeepSeek")

    # 5. Meta AI / Llama (vía Groq Cloud API - Inferencia gratuita ultrarrápida)
    elif provider in ("meta", "llama", "groq"):
        model_name = model or "llama-3.3-70b-versatile"
        # Sanear modelos no aptos para chat o retirados por Groq
        if any(x in model_name.lower() for x in ["guard", "whisper", "tts", "embedding", "vision", "decommissioned"]):
            model_name = "llama-3.3-70b-versatile"
        url = "https://api.groq.com/openai/v1/chat/completions"
        if image_data:
            raise Exception("Groq ha retirado los modelos de visión/multimodalidad en su API gratuita. Para interpretar imágenes o capturas, selecciona Google Gemini (gemini-3.5-flash-lite) o ChatGPT (gpt-4o-mini).")
        user_content = user_prompt

        payload = {
            "model": model_name,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ]
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "TraductorLocal/1.0"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=35) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            choices = data.get("choices", [])
            if choices and "message" in choices[0]:
                return choices[0]["message"].get("content", "")
            raise Exception("No se recibió contenido de Meta AI / Llama")

    # 6. OpenRouter (Multi-proveedor / Modelos gratuitos y de pago)
    elif provider == "openrouter":
        model_name = model or "meta-llama/llama-3.3-70b-instruct:free"
        url = "https://openrouter.ai/api/v1/chat/completions"

        if image_data:
            user_content = [
                {"type": "text", "text": user_prompt},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{image_data.get('mimeType', 'image/png')};base64,{image_data.get('data', '')}"
                    }
                }
            ]
        else:
            user_content = user_prompt

        payload = {
            "model": model_name,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ]
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "http://localhost:8080",
                "X-Title": "Traductor Local",
                "User-Agent": "TraductorLocal/1.0"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=40) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            choices = data.get("choices", [])
            if choices and "message" in choices[0]:
                return choices[0]["message"].get("content", "")
            raise Exception("No se recibió contenido de OpenRouter")

    # 7. Cerebras (Inferencia Llama ultrarrápida en hardware CS-3)
    elif provider == "cerebras":
        if image_data:
            raise Exception("Cerebras está especializado en inferencia ultra-rápida de texto y no soporta visión/imágenes. Utiliza Google Gemini o ChatGPT para traducir con imágenes.")

        model_name = model or "llama3.3-70b"
        url = "https://api.cerebras.ai/v1/chat/completions"
        payload = {
            "model": model_name,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "TraductorLocal/1.0"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            choices = data.get("choices", [])
            if choices and "message" in choices[0]:
                return choices[0]["message"].get("content", "")
            raise Exception("No se recibió contenido de Cerebras")

    else:
        raise Exception(f"Proveedor de IA '{provider}' no reconocido")


def fetch_ai_models(provider, api_key):
    """
    Consulta en tiempo real la lista de modelos disponibles para la cuenta/clave de API del usuario.
    """
    provider = provider.lower().strip()

    # 1. Google Gemini
    if provider == "gemini":
        for ver in ["v1beta", "v1"]:
            url = f"https://generativelanguage.googleapis.com/{ver}/models?key={api_key}"
            req = urllib.request.Request(
                url,
                headers={"Content-Type": "application/json", "x-goog-api-key": api_key}
            )
            try:
                with urllib.request.urlopen(req, timeout=20) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    models = []
                    for m in data.get("models", []):
                        name = m.get("name", "")
                        methods = m.get("supportedGenerationMethods", [])
                        if "generateContent" in methods and "gemini" in name.lower():
                            clean_id = name.replace("models/", "")
                            if any(x in clean_id.lower() for x in ["tts", "image", "transcribe", "robotics", "computer-use", "customtools"]):
                                continue
                            display_name = m.get("displayName", clean_id)
                            models.append({"id": clean_id, "name": f"{clean_id} ({display_name})"})

                    def gemini_order(item):
                        i = item["id"].lower()
                        if "3.5-flash-lite" in i: return 0
                        if "3.5-flash" in i: return 1
                        if "flash-latest" in i: return 2
                        if "flash-lite-latest" in i: return 3
                        if "3.8-flash" in i: return 4
                        if "3-flash" in i: return 5
                        if "2.5-flash" in i: return 6
                        if "2.5-pro" in i: return 7
                        if "1.5-flash" in i: return 8
                        return 10

                    models.sort(key=gemini_order)
                    if models:
                        return models
            except Exception:
                continue

        # Fallback si ambas versiones fallan
        return [
            {"id": "gemini-3.5-flash-lite", "name": "gemini-3.5-flash-lite (Rápido y económico)"},
            {"id": "gemini-3.5-flash", "name": "gemini-3.5-flash (Equilibrado y veloz)"},
            {"id": "gemini-flash-latest", "name": "gemini-flash-latest (Última versión Flash)"},
            {"id": "gemini-3.8-flash", "name": "gemini-3.8-flash (Recomendado)"},
            {"id": "gemini-2.5-flash", "name": "gemini-2.5-flash"}
        ]

    # 2. OpenAI ChatGPT
    elif provider in ("chatgpt", "openai"):
        url = "https://api.openai.com/v1/models"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {api_key}"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            models = []
            raw_list = data.get("data", [])
            for m in raw_list:
                mid = m.get("id", "")
                # Filtrar modelos de chat aptos
                is_chat = mid.startswith(("gpt-4", "gpt-3.5", "o1", "o3", "chatgpt-"))
                is_excluded = any(x in mid for x in ["audio", "realtime", "instruct", "dall-e", "whisper", "tts", "embedding", "moderation", "search"])
                if is_chat and not is_excluded:
                    models.append({"id": mid, "name": mid})

            def openai_order(item):
                mid = item["id"].lower()
                if mid == "gpt-4o-mini": return 0
                if mid == "gpt-4o": return 1
                if mid.startswith("o1-mini"): return 2
                if mid.startswith("o3-mini"): return 3
                if mid.startswith("gpt-4-turbo"): return 4
                return 10

            models.sort(key=openai_order)
            if not models:
                models = [{"id": m.get("id"), "name": m.get("id")} for m in raw_list if "gpt" in m.get("id", "")]
            return models

    # 3. DeepSeek
    elif provider == "deepseek":
        url = "https://api.deepseek.com/models"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {api_key}"})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                models = [{"id": m.get("id"), "name": m.get("id")} for m in data.get("data", [])]
                if models:
                    def deepseek_order(item):
                        mid = item["id"].lower()
                        if "chat" in mid: return 0  # DeepSeek-V3 (menor consumo)
                        if "reasoner" in mid: return 1  # DeepSeek-R1 (razonamiento CoT)
                        return 5
                    models.sort(key=deepseek_order)
                    return models
        except urllib.error.HTTPError:
            raise
        except Exception:
            pass
        return [
            {"id": "deepseek-chat", "name": "deepseek-chat (DeepSeek-V3 - Menor consumo de tokens)"},
            {"id": "deepseek-reasoner", "name": "deepseek-reasoner (DeepSeek-R1 Razonamiento)"}
        ]

    # 4. Anthropic Claude
    elif provider == "claude":
        url = "https://api.anthropic.com/v1/models"
        req = urllib.request.Request(
            url,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                models = []
                for m in data.get("data", []):
                    mid = m.get("id", "")
                    disp = m.get("display_name", mid)
                    models.append({"id": mid, "name": f"{mid} ({disp})"})
                if models:
                    def claude_order(item):
                        mid = item["id"].lower()
                        if "3-5-haiku" in mid: return 0  # Menor consumo y más rápido
                        if "haiku" in mid: return 1
                        if "3-5-sonnet" in mid: return 2
                        if "sonnet" in mid: return 3
                        if "opus" in mid: return 4
                        return 10
                    models.sort(key=claude_order)
                    return models
        except urllib.error.HTTPError:
            raise
        except Exception:
            pass
        return [
            {"id": "claude-3-5-haiku-20241022", "name": "claude-3-5-haiku-20241022 (Claude 3.5 Haiku - Menor consumo de tokens)"},
            {"id": "claude-3-haiku-20240307", "name": "claude-3-haiku-20240307 (Claude 3 Haiku)"},
            {"id": "claude-3-5-sonnet-20241022", "name": "claude-3-5-sonnet-20241022 (Claude 3.5 Sonnet)"},
            {"id": "claude-3-opus-20240229", "name": "claude-3-opus-20240229 (Claude 3 Opus)"}
        ]

    # 5. Meta AI / Llama (Groq)
    elif provider in ("meta", "llama", "groq"):
        url = "https://api.groq.com/openai/v1/models"
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "TraductorLocal/1.0"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                models = []
                for m in data.get("data", []):
                    mid = m.get("id", "")
                    # Excluir modelos de clasificación / moderación (llama-guard, prompt-guard), audio (whisper) y visión/preview dados de baja
                    if any(x in mid.lower() for x in ["guard", "whisper", "tts", "embedding", "moderation", "audio", "vision", "decommissioned"]):
                        continue
                    if any(x in mid.lower() for x in ["llama", "mixtral", "gemma"]):
                        label = mid
                        if "3.3-70b-versatile" in mid.lower():
                            label = f"{mid} (Recomendado - 70B Alta precisión)"
                        elif "3.1-8b-instant" in mid.lower():
                            label = f"{mid} (Ultrarrápido - Menor consumo de tokens)"
                        models.append({"id": mid, "name": label})
                if models:
                    def meta_order(item):
                        mid = item["id"].lower()
                        if "3.3-70b-versatile" in mid: return 0
                        if "3.1-8b-instant" in mid: return 1
                        return 10
                    models.sort(key=meta_order)
                    return models
        except urllib.error.HTTPError:
            raise
        except Exception:
            pass
        return [
            {"id": "llama-3.3-70b-versatile", "name": "llama-3.3-70b-versatile (Recomendado - 70B Alta precisión)"},
            {"id": "llama-3.1-8b-instant", "name": "llama-3.1-8b-instant (Ultrarrápido - Menor consumo de tokens)"}
        ]

    # 6. OpenRouter
    elif provider == "openrouter":
        url = "https://openrouter.ai/api/v1/models"
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "http://localhost:8080",
                "X-Title": "Traductor Local",
                "User-Agent": "TraductorLocal/1.0"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                models = []
                for m in data.get("data", []):
                    mid = m.get("id", "")
                    name = m.get("name", mid)
                    # Priorizar modelos de chat/instrucción
                    if any(x in mid.lower() for x in ["embed", "moderation", "audio", "whisper", "tts"]):
                        continue
                    is_free = ":free" in mid.lower()
                    label = f"{mid} ({'Gratis - ' if is_free else ''}{name})"
                    models.append({"id": mid, "name": label, "is_free": is_free})

                if models:
                    def openrouter_order(item):
                        mid = item["id"].lower()
                        if "llama-3.3-70b-instruct:free" in mid: return 0
                        if "gemini-2.0-flash-exp:free" in mid: return 1
                        if "deepseek-r1:free" in mid: return 2
                        if "llama-3.1-8b-instruct:free" in mid: return 3
                        if item.get("is_free"): return 4
                        if "gpt-4o-mini" in mid: return 5
                        if "claude-3.5-haiku" in mid: return 6
                        return 20

                    models.sort(key=openrouter_order)
                    # Limitar a los 100 mejores para no saturar el DOM
                    return [{"id": m["id"], "name": m["name"]} for m in models[:100]]
        except urllib.error.HTTPError:
            raise
        except Exception:
            pass
        return [
            {"id": "meta-llama/llama-3.3-70b-instruct:free", "name": "meta-llama/llama-3.3-70b-instruct:free (Gratis)"},
            {"id": "google/gemini-2.0-flash-exp:free", "name": "google/gemini-2.0-flash-exp:free (Gratis)"},
            {"id": "deepseek/deepseek-r1:free", "name": "deepseek/deepseek-r1:free (Gratis)"},
            {"id": "meta-llama/llama-3.1-8b-instruct:free", "name": "meta-llama/llama-3.1-8b-instruct:free (Gratis)"},
            {"id": "openai/gpt-4o-mini", "name": "openai/gpt-4o-mini (Popular)"},
            {"id": "anthropic/claude-3.5-haiku", "name": "anthropic/claude-3.5-haiku"}
        ]

    # 7. Cerebras
    elif provider == "cerebras":
        url = "https://api.cerebras.ai/v1/models"
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "TraductorLocal/1.0"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                models = []
                for m in data.get("data", []):
                    mid = m.get("id", "")
                    label = mid
                    if "3.3-70b" in mid.lower():
                        label = f"{mid} (Recomendado - 70B Inferencia Ultrarrápida)"
                    elif "3.1-8b" in mid.lower():
                        label = f"{mid} (Ultrarrápido CS-3)"
                    models.append({"id": mid, "name": label})
                if models:
                    def cerebras_order(item):
                        mid = item["id"].lower()
                        if "3.3-70b" in mid: return 0
                        if "3.1-8b" in mid: return 1
                        return 10
                    models.sort(key=cerebras_order)
                    return models
        except urllib.error.HTTPError:
            raise
        except Exception:
            pass
        return [
            {"id": "llama3.3-70b", "name": "llama3.3-70b (Recomendado - 70B Inferencia Ultrarrápida)"},
            {"id": "llama3.1-8b", "name": "llama3.1-8b (Ultrarrápido CS-3)"}
        ]

    else:
        raise Exception(f"Proveedor '{provider}' no soportado")


# ========================================================
# Gestión de Archivos Efímeros (One-Time Download) y Refinamiento IA
# ========================================================
EPHEMERAL_FILES = {}
EPHEMERAL_FILES_LOCK = threading.Lock()
LT_TEMP_DIR = "/tmp/libretranslate-files-translate"

# Asegurar permisos de lectura y escritura para LibreTranslate en el volumen compartido
if os.path.exists(LT_TEMP_DIR):
    try:
        os.chmod(LT_TEMP_DIR, 0o777)
    except Exception:
        pass

def cleanup_ephemeral_files_loop():
    """
    Recolector en segundo plano que elimina cualquier archivo efímero
    que exceda 10 minutos (por ejemplo, si el usuario cerró la pestaña sin descargar).
    """
    while True:
        try:
            time.sleep(60)
            now = time.time()
            expired_tokens = []
            with EPHEMERAL_FILES_LOCK:
                for token, item in list(EPHEMERAL_FILES.items()):
                    if now - item.get("created_at", 0) > 600:
                        expired_tokens.append(token)
                        lt_fn = item.get("lt_filename")
                        if lt_fn:
                            lt_p = os.path.join(LT_TEMP_DIR, lt_fn)
                            if os.path.exists(lt_p):
                                try:
                                    os.remove(lt_p)
                                except Exception:
                                    pass
                for t in expired_tokens:
                    EPHEMERAL_FILES.pop(t, None)

            if os.path.exists(LT_TEMP_DIR):
                for fname in os.listdir(LT_TEMP_DIR):
                    fpath = os.path.join(LT_TEMP_DIR, fname)
                    try:
                        if os.path.isfile(fpath) and (now - os.path.getmtime(fpath) > 600):
                            os.remove(fpath)
                    except Exception:
                        pass
        except Exception:
            pass

# Iniciar el recolector en un hilo daemon
cleanup_thread = threading.Thread(target=cleanup_ephemeral_files_loop, daemon=True)
cleanup_thread.start()


def purge_lt_temp_files(lt_filename):
    """
    Elimina físicamente cualquier archivo temporal generado por LibreTranslate
    para esta transacción (tanto el archivo de subida original como el de salida).
    """
    if not lt_filename or not os.path.exists(LT_TEMP_DIR):
        return
    prefix = lt_filename.split(".")[0]
    try:
        for f in os.listdir(LT_TEMP_DIR):
            if f.startswith(prefix) or f == lt_filename:
                fpath = os.path.join(LT_TEMP_DIR, f)
                try:
                    if os.path.isfile(fpath):
                        os.remove(fpath)
                except Exception:
                    pass
    except Exception:
        pass


def build_multipart(fields, file_field_name, filename, file_bytes, content_type="application/octet-stream"):
    """
    Construye un payload multipart/form-data estándar en Python puro.
    """
    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
    lines = []
    for k, v in fields.items():
        lines.append(f"--{boundary}".encode("latin-1"))
        lines.append(f'Content-Disposition: form-data; name="{k}"'.encode("latin-1"))
        lines.append(b"")
        lines.append(str(v).encode("utf-8"))
    lines.append(f"--{boundary}".encode("latin-1"))
    lines.append(f'Content-Disposition: form-data; name="{file_field_name}"; filename="{filename}"'.encode("latin-1"))
    lines.append(f"Content-Type: {content_type}".encode("latin-1"))
    lines.append(b"")
    lines.append(file_bytes)
    lines.append(f"--{boundary}--".encode("latin-1"))
    lines.append(b"")
    return b"\r\n".join(lines), f"multipart/form-data; boundary={boundary}"


def refine_document_with_ai(file_bytes, filename, source_lang, target_lang, provider, api_key, model):
    """
    Refina un documento traducido preliminarmente por LibreTranslate utilizando la IA configurada.
    Conserva la estructura original del archivo (Markdown, HTML, subtítulos .srt/.vtt, o párrafos).
    """
    ext = os.path.splitext(filename)[1].lower()
    text_exts = [".txt", ".md", ".srt", ".vtt", ".html", ".htm", ".json", ".csv", ".tsv", ".xml", ".yaml", ".yml"]

    # 1. Archivos basados en texto legible
    if ext in text_exts or not ext:
        text = None
        for enc in ["utf-8", "utf-8-sig", "latin-1"]:
            try:
                text = file_bytes.decode(enc)
                break
            except Exception:
                continue

        if text is None or not text.strip():
            return file_bytes, False

        # Prompts especializados según formato de documento
        if ext in [".srt", ".vtt"]:
            system_prompt = (
                f"Eres un traductor y subtitulador profesional nativo. "
                f"Tu misión es REFINAR y PERFECCIONAR la traducción de estos subtítulos del idioma {source_lang} al idioma {target_lang}.\n"
                f"REGLA CRÍTICA ABSOLUTA:\n"
                f"- Mantén RIGUROSAMENTE los números de índice y las marcas de tiempo exactas (ejemplo: '1\\n00:01:23,456 --> 00:01:25,789') en sus posiciones y líneas idénticas.\n"
                f"- Refina exclusivamente los diálogos/textos haciéndolos 100% naturales, fluidos y con la mejor calidad idiomática en {target_lang}.\n"
                f"- NO incluyas introducciones, comentarios, ni notas explicativas. Devuelve ÚNICAMENTE el archivo de subtítulos pulido."
            )
        elif ext in [".md"]:
            system_prompt = (
                f"Eres un editor y traductor técnico profesional. "
                f"Tu misión es REFINAR y PERFECCIONAR la traducción de este documento Markdown del idioma {source_lang} al idioma {target_lang}.\n"
                f"REGLAS OBLIGATORIAS:\n"
                f"- Conserva intacta toda la sintaxis Markdown: encabezados (#, ##), listas (- , * , 1.), negritas, cursivas, tablas, enlaces [texto](url) y bloques de código con triple backtick.\n"
                f"- Eleva la calidad lingüística a un estándar nativo, fluido, claro y preciso en {target_lang}.\n"
                f"- NO agregues preámbulos, notas ni saludos. Devuelve ÚNICAMENTE el documento Markdown completo y refinado."
            )
        elif ext in [".html", ".htm"]:
            system_prompt = (
                f"Eres un especialista en traducción y localización web. "
                f"Tu misión es REFINAR y PERFECCIONAR la traducción de este documento HTML del idioma {source_lang} al idioma {target_lang}.\n"
                f"REGLAS:\n"
                f"- Conserva absolutamente todas las etiquetas, atributos y estructura HTML intactos.\n"
                f"- Refina únicamente el texto legible por humanos haciéndolo natural y fluido en {target_lang}.\n"
                f"- Devuelve ÚNICAMENTE el código HTML resultante, sin comentarios ni explicaciones adicionales."
            )
        else:
            system_prompt = (
                f"Eres un traductor editorial y corrector de estilo bilingüe de alto nivel. "
                f"Tu objetivo es REFINAR y PERFECCIONAR la traducción de este documento del idioma {source_lang} al idioma {target_lang}.\n"
                f"El texto provisto es una traducción automática preliminar de LibreTranslate. Debes corregir errores, rigidez, falsos amigos y falta de naturalidad, produciendo una versión excelente, fluida e idiomática en {target_lang}.\n"
                f"REGLAS:\n"
                f"- Conserva la estructura exacta de párrafos, sangrías, numeraciones y saltos de línea del documento original.\n"
                f"- NO agregues introducciones (como 'Aquí tienes la traducción:'), ni notas explicativas al final.\n"
                f"- Devuelve EXCLUSIVAMENTE el contenido del documento refinado."
            )

        MAX_CHUNK_CHARS = 45000
        try:
            user_msg = (
                f"A continuación se presenta el contenido del documento traducido preliminarmente al idioma {target_lang}. "
                f"Refínalo y devuélvelo en su totalidad según las instrucciones:\n\n{text}"
            )
            if len(user_msg) <= MAX_CHUNK_CHARS:
                refined_text = call_ai_provider(provider, api_key, model, system_prompt, user_msg)
                if refined_text and refined_text.strip():
                    return refined_text.strip().encode("utf-8"), True
                return file_bytes, False
            else:
                paragraphs = text.split("\n\n")
                chunks = []
                curr_chunk = []
                curr_len = 0
                for p in paragraphs:
                    p_len = len(p)
                    if curr_len + p_len > MAX_CHUNK_CHARS and curr_chunk:
                        chunks.append("\n\n".join(curr_chunk))
                        curr_chunk = [p]
                        curr_len = p_len
                    else:
                        curr_chunk.append(p)
                        curr_len += p_len + 2
                if curr_chunk:
                    chunks.append("\n\n".join(curr_chunk))

                refined_parts = []
                for c in chunks:
                    c_msg = (
                        f"A continuación se presenta una sección del documento traducido preliminarmente al idioma {target_lang}. "
                        f"Refínala y devuélvela exactamente según las instrucciones:\n\n{c}"
                    )
                    ref_part = call_ai_provider(provider, api_key, model, system_prompt, c_msg)
                    refined_parts.append(ref_part.strip() if ref_part else c)
                full_refined = "\n\n".join(refined_parts)
                return full_refined.encode("utf-8"), True
        except Exception as e:
            print(f"Error refinando texto con {provider}: {e}")
            return file_bytes, False

    # 2. Documentos DOCX (.docx)
    elif ext == ".docx":
        try:
            import xml.etree.ElementTree as ET
            in_buf = io.BytesIO(file_bytes)
            with zipfile.ZipFile(in_buf, 'r') as z_in:
                namelist = z_in.namelist()
                if 'word/document.xml' not in namelist:
                    return file_bytes, False
                doc_xml_bytes = z_in.read('word/document.xml')

            tree = ET.fromstring(doc_xml_bytes)
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

            paragraphs_text = []
            for p in tree.iterfind('.//w:p', ns):
                texts = [node.text for node in p.iterfind('.//w:t', ns) if node.text]
                if texts:
                    full_p = "".join(texts).strip()
                    if full_p:
                        paragraphs_text.append(full_p)

            if not paragraphs_text:
                return file_bytes, False

            combined_text = "\n\n".join(paragraphs_text)
            if len(combined_text) <= 45000:
                system_prompt = (
                    f"Eres un traductor profesional. A continuación se presentan los párrafos traducidos de un documento DOCX del idioma {source_lang} al {target_lang}.\n"
                    f"Tu tarea es REFINAR cada párrafo para que sea totalmente natural, fluido y correcto en {target_lang}.\n"
                    f"REGLA ESTRICTA:\n"
                    f"- Devuelve exactamente el mismo número de párrafos ({len(paragraphs_text)}) separados por doble salto de línea (\\n\\n).\n"
                    f"- No agregues notas, numeraciones no existentes ni comentarios."
                )
                refined_full = call_ai_provider(provider, api_key, model, system_prompt, combined_text)
                refined_paragraphs = [p.strip() for p in refined_full.split("\n\n") if p.strip()]

                if len(refined_paragraphs) == len(paragraphs_text):
                    idx = 0
                    for p in tree.iterfind('.//w:p', ns):
                        t_nodes = list(p.iterfind('.//w:t', ns))
                        if t_nodes and any(n.text for n in t_nodes):
                            t_nodes[0].text = refined_paragraphs[idx]
                            for extra_n in t_nodes[1:]:
                                extra_n.text = ""
                            idx += 1

                    new_doc_xml = ET.tostring(tree, encoding='utf-8')
                    out_buf = io.BytesIO()
                    with zipfile.ZipFile(in_buf, 'r') as z_in, zipfile.ZipFile(out_buf, 'w', compression=zipfile.ZIP_DEFLATED) as z_out:
                        for item in z_in.infolist():
                            if item.filename == 'word/document.xml':
                                z_out.writestr(item, new_doc_xml)
                            else:
                                z_out.writestr(item, z_in.read(item.filename))
                    return out_buf.getvalue(), True
        except Exception as e:
            print(f"Error refinando DOCX con {provider}: {e}")
            return file_bytes, False

    return file_bytes, False


class TranslationProxyHandler(http.server.SimpleHTTPRequestHandler):
    timeout = 30

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_json(self, status_code, data):
        response_bytes = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(response_bytes)

    def do_GET(self):
        # Obtener configuración de IA guardada en servidor
        if self.path == "/api/ai_config":
            try:
                if os.path.exists(CONFIG_FILE):
                    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self.send_json(200, data)
                else:
                    self.send_json(200, {})
            except Exception as e:
                self.send_json(500, {"error": str(e)})
            return

        # Estado de cuota gratuita y tokens del sistema por proveedor
        if self.path == "/api/ai_free_quota":
            client_ip = self.client_address[0]
            now = time.time()
            one_day_ago = now - 86400
            history = [t for t in FREE_QUOTA_TRACKER.get(client_ip, []) if t > one_day_ago]
            remaining = max(0, FREE_QUOTA_LIMIT_PER_DAY - len(history))

            sys_key = get_system_key("gemini")
            has_gemini = bool(sys_key)

            prov_status = {
                "gemini": {
                    "available": has_gemini,
                    "remaining": remaining if has_gemini else 0,
                    "limit": FREE_QUOTA_LIMIT_PER_DAY,
                    "label": f"Tokens Gratuitos Activos ({remaining}/{FREE_QUOTA_LIMIT_PER_DAY} hoy)" if has_gemini else "No configurado"
                }
            }
            self.send_json(200, {
                "status": "ok",
                "providers": prov_status,
                "remainingDaily": remaining,
                "limitDaily": FREE_QUOTA_LIMIT_PER_DAY
            })
            return

        # Descarga de archivos traducidos con borrado inmediato (One-Time Download / Ephemeral)
        if self.path.startswith("/download_file/"):
            self.handle_download_file()
            return

        # Rutas de la API de LibreTranslate que queremos proxear
        if self.path.startswith(("/languages", "/frontend/")):
            self.proxy_request("GET")
        else:
            super().do_GET()

    def do_POST(self):
        # Endpoint de traducción de archivos con refinamiento IA y almacenamiento efímero
        if self.path.startswith("/translate_file"):
            self.handle_translate_file()
            return

        # Endpoint de refinamiento de traducción con IA
        if self.path == "/api/ai_refine":
            self.handle_ai_refine()
            return

        # Endpoint para listar modelos disponibles en tiempo real
        if self.path == "/api/ai_models":
            self.handle_ai_models()
            return

        # Guardar configuración de IA en el servidor
        if self.path == "/api/ai_config":
            self.handle_ai_config_save()
            return

        # Rutas POST de la API de LibreTranslate
        if self.path.startswith(("/translate", "/detect", "/suggest")):
            self.proxy_request("POST")
        else:
            self.send_error(404, "Endpoint no encontrado")

    def handle_download_file(self):
        filename = self.path.split("/download_file/")[-1].split("?")[0]

        # 1. Revisar si está en el almacén efímero en memoria (RAM)
        item = None
        with EPHEMERAL_FILES_LOCK:
            item = EPHEMERAL_FILES.pop(filename, None)

        if item:
            self.send_response(200)
            self.send_header("Content-Type", item.get("content_type", "application/octet-stream"))
            self.send_header("Content-Disposition", f'attachment; filename="{item.get("filename", filename)}"')
            self.send_header("Content-Length", str(len(item["data"])))
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            try:
                self.wfile.write(item["data"])
            except Exception:
                pass
            finally:
                # Requerimiento 2: Eliminar rastros del archivo de inmediato
                lt_fn = item.get("lt_filename")
                if lt_fn:
                    purge_lt_temp_files(lt_fn)
                del item
            return

        # 2. Si no estaba en memoria efímera, consultar directamente a LibreTranslate
        target_url = f"{LIBRETRANSLATE_HOST}/download_file/{filename}"
        try:
            req = urllib.request.Request(target_url, headers={"User-Agent": "TraductorLocal/1.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
                self.send_response(200)
                for h, v in resp.getheaders():
                    if h.lower() not in ["transfer-encoding", "content-length"]:
                        self.send_header(h, v)
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.send_header("Pragma", "no-cache")
                self.send_header("Expires", "0")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(data)
                del data
        except urllib.error.HTTPError:
            self.send_error(404, "El archivo solicitado ya no está disponible (ha sido descargado y eliminado del servidor por privacidad, o ha expirado).")
            return
        except Exception as e:
            self.send_error(500, f"Error descargando archivo: {str(e)}")
            return
        finally:
            # Requerimiento 2: Borrar físicamente de LibreTranslate tras descargar
            purge_lt_temp_files(filename)

    def handle_translate_file(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0:
            self.send_json(400, {"error": "Cuerpo de solicitud vacío"})
            return

        content_type = self.headers.get("Content-Type", "")
        raw_body = self.rfile.read(content_length)

        # Parsear multipart/form-data con email policy estándar
        try:
            msg = email.message_from_bytes(
                b"Content-Type: " + content_type.encode("latin-1") + b"\r\n\r\n" + raw_body,
                policy=default
            )
        except Exception as e:
            self.send_json(400, {"error": f"Error parseando multipart: {str(e)}"})
            return

        source = "auto"
        target = "es"
        ai_provider = ""
        ai_model = ""
        ai_key = ""
        use_free_tier = False
        file_bytes = None
        orig_filename = "documento.txt"

        for part in msg.iter_parts():
            name = part.get_param("name", header="content-disposition")
            fn = part.get_filename()
            if fn or name == "file":
                orig_filename = fn or "documento.txt"
                file_bytes = part.get_payload(decode=True)
            elif name == "source":
                source = part.get_content().strip() or "auto"
            elif name == "target":
                target = part.get_content().strip() or "es"
            elif name in ("aiProvider", "ai_provider"):
                ai_provider = part.get_content().strip().lower()
            elif name in ("aiModel", "ai_model"):
                ai_model = part.get_content().strip()
            elif name in ("aiApiKey", "ai_api_key"):
                ai_key = part.get_content().strip()
            elif name in ("useFreeTier", "use_free_tier"):
                use_free_tier = part.get_content().strip().lower() in ("true", "1", "yes")

        if not file_bytes:
            self.send_json(400, {"error": "No se recibió ningún archivo para traducir"})
            return

        # Si el cliente no envió la IA en el form, consultar si hay una IA guardada en servidor
        if not ai_provider or ai_provider == "none":
            if os.path.exists(CONFIG_FILE):
                try:
                    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                        server_cfg = json.load(f)
                    for p, val in server_cfg.items():
                        if val.get("enabled"):
                            ai_provider = p
                            if not ai_model:
                                ai_model = val.get("model", "")
                            if not ai_key:
                                ai_key = val.get("apiKey", "")
                            if val.get("useFreeTier"):
                                use_free_tier = True
                            break
                except Exception:
                    pass

        # 1. Enviar el archivo original a LibreTranslate para traducción base local estructurada
        lt_fields = {"source": source, "target": target}
        lt_body, lt_ctype = build_multipart(lt_fields, "file", orig_filename, file_bytes)

        lt_req = urllib.request.Request(
            f"{LIBRETRANSLATE_HOST}/translate_file",
            data=lt_body,
            headers={"Content-Type": lt_ctype, "User-Agent": "TraductorLocal/1.0"},
            method="POST"
        )

        try:
            with urllib.request.urlopen(lt_req, timeout=120) as resp:
                lt_res = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8", errors="ignore")
            try:
                err_j = json.loads(err_msg)
                err_msg = err_j.get("error", err_msg)
            except Exception:
                pass
            self.send_json(e.code, {"error": f"Error en LibreTranslate: {err_msg}"})
            return
        except Exception as e:
            self.send_json(502, {"error": f"No se pudo comunicar con LibreTranslate: {str(e)}"})
            return

        lt_url = lt_res.get("translatedFileUrl", "")
        if not lt_url:
            self.send_json(500, {"error": "LibreTranslate no devolvió la URL del archivo traducido"})
            return

        lt_filename = lt_url.split("/download_file/")[-1]

        # 2. Descargar el archivo traducido por LibreTranslate
        try:
            with urllib.request.urlopen(f"{LIBRETRANSLATE_HOST}/download_file/{lt_filename}", timeout=60) as resp:
                translated_bytes = resp.read()
        except Exception as e:
            self.send_json(500, {"error": f"Error recuperando archivo traducido de LibreTranslate: {str(e)}"})
            return

        # 3. Refinar con IA si está configurada y activa
        final_bytes = translated_bytes
        is_refined = False

        if ai_provider and ai_provider != "none":
            # Resolver API Key si es cuota gratuita de Gemini
            resolved_key = ai_key
            if (use_free_tier and ai_provider == "gemini") or not resolved_key:
                if ai_provider == "gemini":
                    resolved_key = get_system_key("gemini")
                    if resolved_key:
                        client_ip = self.client_address[0]
                        ok, _, _ = check_and_record_free_quota(client_ip)
                        if not ok:
                            resolved_key = ""
                else:
                    resolved_key = get_system_key(ai_provider)

            if resolved_key:
                try:
                    ref_bytes, ok = refine_document_with_ai(
                        translated_bytes,
                        orig_filename,
                        source,
                        target,
                        ai_provider,
                        resolved_key,
                        ai_model
                    )
                    if ok:
                        final_bytes = ref_bytes
                        is_refined = True
                except Exception as e:
                    print(f"Refinamiento de documento falló con {ai_provider}, usando traducción local: {e}")

        # 4. Inmediatamente purgar los archivos temporales generados en LibreTranslate
        purge_lt_temp_files(lt_filename)

        # 5. Guardar en almacén efímero en memoria (One-Time Download)
        token_id = f"trans_{uuid.uuid4().hex[:16]}_{orig_filename}"
        guess_type = mimetypes.guess_type(orig_filename)[0] or "application/octet-stream"
        if orig_filename.lower().endswith(".md"):
            guess_type = "text/markdown; charset=utf-8"
        elif orig_filename.lower().endswith(".txt"):
            guess_type = "text/plain; charset=utf-8"

        with EPHEMERAL_FILES_LOCK:
            EPHEMERAL_FILES[token_id] = {
                "data": final_bytes,
                "filename": orig_filename,
                "content_type": guess_type,
                "created_at": time.time(),
                "is_refined": is_refined,
                "ai_provider": ai_provider if is_refined else None,
                "lt_filename": lt_filename
            }

        self.send_json(200, {
            "translatedFileUrl": f"/download_file/{token_id}",
            "refined": is_refined,
            "aiProvider": ai_provider if is_refined else None,
            "ephemeral": True
        })

    def handle_ai_models(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0:
            self.send_json(400, {"error": "Cuerpo de solicitud vacío"})
            return

        try:
            body = json.loads(self.rfile.read(content_length).decode("utf-8"))
        except Exception as e:
            self.send_json(400, {"error": f"JSON inválido: {str(e)}"})
            return

        provider = body.get("provider", "").strip().lower()
        api_key = body.get("apiKey", "").strip()
        use_free_tier = body.get("useFreeTier", False)

        # Si no hay clave personal o está activada la cuota gratuita (solo en gemini)
        if not api_key or (use_free_tier and provider == "gemini"):
            if provider == "gemini":
                sys_key = get_system_key("gemini")
                if sys_key:
                    api_key = sys_key
                else:
                    self.send_json(400, {"error": "Se requiere la API Key para consultar modelos de Gemini."})
                    return
            else:
                self.send_json(400, {"error": f"Se requiere una API Key personal para {provider.title()}."})
                return

        try:
            models = fetch_ai_models(provider, api_key)
            self.send_json(200, {"status": "ok", "provider": provider, "models": models})
        except urllib.error.HTTPError as e:
            err_text = e.read().decode("utf-8", errors="replace")
            try:
                err_json = json.loads(err_text)
                if "error" in err_json:
                    err_text = err_json["error"].get("message", err_text) if isinstance(err_json["error"], dict) else str(err_json["error"])
            except Exception:
                pass
            self.send_json(e.code, {"error": f"Error al consultar modelos ({provider}): {err_text}"})
        except Exception as e:
            self.send_json(500, {"error": f"Error obteniendo modelos de {provider}: {str(e)}"})

    def handle_ai_refine(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0:
            self.send_json(400, {"error": "Cuerpo de solicitud vacío"})
            return

        try:
            body = json.loads(self.rfile.read(content_length).decode("utf-8"))
        except Exception as e:
            self.send_json(400, {"error": f"JSON inválido: {str(e)}"})
            return

        provider = body.get("provider", "").strip().lower()
        api_key = body.get("apiKey", "").strip()
        model = body.get("model", "").strip()
        source_text = body.get("sourceText", "").strip()
        local_translation = body.get("localTranslation", "").strip()
        source_lang = body.get("sourceLang", "auto")
        target_lang = body.get("targetLang", "es")
        test_only = body.get("testOnly", False)
        test_model_only = body.get("testModelOnly", False)
        is_prompt_mode = body.get("isPromptMode", False)
        image_data = body.get("imageData", None)
        use_free_tier = body.get("useFreeTier", False)

        used_system_quota = False
        remaining_free_quota = None

        # Soporte de tokens gratuitos / cuota del sistema sin requerir API Key personal (solo Gemini)
        if (use_free_tier and provider == "gemini") or not api_key:
            if provider == "gemini":
                sys_key = get_system_key("gemini")
                if not sys_key:
                    self.send_json(400, {"error": "No se encontró cuota gratuita configurada para Gemini. Ingresa tu API Key personal."})
                    return

                client_ip = self.client_address[0]
                ok, msg, remaining = check_and_record_free_quota(client_ip)
                if not ok:
                    self.send_json(429, {"error": msg})
                    return

                api_key = sys_key
                used_system_quota = True
                remaining_free_quota = remaining
            else:
                self.send_json(400, {"error": f"Se requiere una API Key personal para {provider.title()}."})
                return

        # 1. Modo test de modelo específico (realiza una inferencia breve y mide tiempo de respuesta)
        if test_model_only:
            if not model:
                self.send_json(400, {"error": "Selecciona un modelo del desplegable para poder probarlo"})
                return
            system_prompt = "Eres un asistente de verificación técnica."
            user_prompt = "Responde únicamente la palabra: OK"
            start_t = time.time()
            try:
                reply = call_ai_provider(provider, api_key, model, system_prompt, user_prompt)
                latency_ms = int((time.time() - start_t) * 1000)
                self.send_json(200, {
                    "status": "ok",
                    "message": f"Modelo '{model}' responde correctamente",
                    "latencyMs": latency_ms,
                    "reply": reply.strip(),
                    "usedFreeTier": used_system_quota
                })
            except urllib.error.HTTPError as e:
                err_text = e.read().decode("utf-8", errors="replace")
                try:
                    err_json = json.loads(err_text)
                    if "error" in err_json:
                        err_text = err_json["error"].get("message", err_text) if isinstance(err_json["error"], dict) else str(err_json["error"])
                except Exception:
                    pass
                self.send_json(e.code, {"error": f"Fallo en modelo {model}: {err_text}"})
            except Exception as e:
                self.send_json(500, {"error": f"Error probando modelo {model}: {str(e)}"})
            return

        # 2. Modo test de API Key general: verificación de credenciales vía API de modelos sin depender de un modelo particular
        if test_only:
            try:
                models = fetch_ai_models(provider, api_key)
                status_msg = f"Conexión exitosa con {provider.title()}" + (" (Cuota gratuita del sistema activa)" if used_system_quota else "")
                self.send_json(200, {
                    "status": "ok",
                    "message": status_msg,
                    "usedFreeTier": used_system_quota,
                    "remainingQuota": remaining_free_quota,
                    "models": models
                })
            except urllib.error.HTTPError as e:
                err_text = e.read().decode("utf-8", errors="replace")
                try:
                    err_json = json.loads(err_text)
                    if "error" in err_json:
                        err_text = err_json["error"].get("message", err_text) if isinstance(err_json["error"], dict) else str(err_json["error"])
                except Exception:
                    pass
                self.send_json(e.code, {"error": f"Error de autenticación con {provider}: {err_text}"})
            except Exception as e:
                self.send_json(500, {"error": f"Error conectando con {provider}: {str(e)}"})
            return

        if not source_text and not image_data:
            self.send_json(400, {"error": "Se requiere texto original o una imagen adjunta para procesar"})
            return

        if is_prompt_mode:
            # Modo Generador de Prompt para Programación (Inglés optimizado para ahorrar tokens)
            system_prompt = (
                "You are an elite Staff Software Engineer and Prompt Engineering Architect. "
                "Your objective is to translate and transform the user's software requirements, questions, "
                "code snippets, or technical error descriptions into an ultra-optimized, high-precision English prompt. "
                "This prompt will be supplied directly to advanced coding LLMs (such as Claude 3.7 Sonnet, OpenAI o3/GPT-4o, Cursor, or Gemini) "
                "to achieve maximum code quality, zero hallucinations, and optimal token efficiency.\n\n"
                "CRITICAL PROMPT ENGINEERING RULES:\n"
                "1. LANGUAGE: The generated prompt MUST be 100% in professional, grammatically flawless technical English.\n"
                "2. STRUCTURE: Structure the prompt cleanly using concise Markdown:\n"
                "   - **Role & Objective**: Brief, clear statement of what the AI engineer must do.\n"
                "   - **Context / Requirements**: Functional specifications translated accurately from the user's input.\n"
                "   - **Visual / UI Analysis** (ONLY if an image is provided): Precise interpretation of UI components, layout, styling, mockups, terminal errors, architecture diagrams, or code visible in the image.\n"
                "   - **Technical Constraints**: Code quality standards, modern best practices, frameworks, clean code.\n"
                "   - **Expected Output**: Exact deliverable requested (e.g. production-ready code, step-by-step fix, schema).\n"
                "3. TOKEN EFFICIENCY: Direct and high-density information. Eliminate unnecessary conversational preamble, filler greetings, or apologies.\n"
                "4. OUTPUT FORMAT: Respond ONLY with the finalized English prompt ready to copy and paste. Do not add meta-commentary like 'Here is your prompt:' before or after."
            )

            user_prompt = (
                f"User Request (Original):\n{source_text if source_text else '(Ver imagen adjunta)'}\n\n"
                f"Preliminary Machine Translation:\n{local_translation if local_translation else 'N/A'}\n\n"
                "Generate the perfected, token-optimized English programming prompt:"
            )
        else:
            # Modo Traducción Perfeccionada estándar
            system_prompt = (
                "Eres un traductor profesional de nivel nativo y editor lingüístico de élite. "
                "Tu tarea es refinar y perfeccionar la traducción de un texto. "
                "Se te proporciona el texto original y una traducción preliminar básica. "
                "Mejora la traducción para que suene completamente natural, idiomática, precisa y fluida, "
                "preservando fielmente el significado exacto, tono, estilo, mayúsculas, puntuación y formato original. "
                "IMPORTANTE: Responde ÚNICAMENTE con la traducción final perfeccionada, sin notas, explicaciones ni formato adicional."
            )

            user_prompt = (
                f"Texto original ({source_lang}):\n{source_text}\n\n"
                f"Traducción preliminar ({target_lang}):\n{local_translation}\n\n"
                f"Traducción final perfeccionada en {target_lang}:"
            )

        try:
            refined_text = call_ai_provider(provider, api_key, model, system_prompt, user_prompt, image_data=image_data)
            # Limpiar posibles comillas envolventes no deseadas si no eran parte del texto
            clean_text = refined_text.strip()
            if not is_prompt_mode and clean_text.startswith('"') and clean_text.endswith('"') and not source_text.startswith('"'):
                clean_text = clean_text[1:-1].strip()

            self.send_json(200, {
                "refinedText": clean_text,
                "provider": provider,
                "model": model,
                "isPromptMode": is_prompt_mode,
                "usedFreeTier": used_system_quota,
                "remainingQuota": remaining_free_quota,
                "originalTranslation": local_translation
            })
        except urllib.error.HTTPError as e:
            err_text = e.read().decode("utf-8", errors="replace")
            try:
                err_json = json.loads(err_text)
                if "error" in err_json:
                    err_text = err_json["error"].get("message", err_text) if isinstance(err_json["error"], dict) else str(err_json["error"])
            except Exception:
                pass
            self.send_json(e.code, {"error": f"Error de API ({provider}): {err_text}"})
        except Exception as e:
            self.send_json(500, {"error": f"Error comunicando con {provider}: {str(e)}"})

    def handle_ai_config_save(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0:
            self.send_json(400, {"error": "Cuerpo de solicitud vacío"})
            return

        try:
            data = json.loads(self.rfile.read(content_length).decode("utf-8"))
            os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            self.send_json(200, {"status": "saved", "message": "Configuración guardada en servidor"})
        except Exception as e:
            self.send_json(500, {"error": f"Error guardando configuración: {str(e)}"})

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


class ThreadedHTTPServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

def run_http_server(port):
    with ThreadedHTTPServer(("", port), TranslationProxyHandler) as httpd:
        print(f" Servidor HTTP multihilo activo en: http://0.0.0.0:{port}")
        sys.stdout.flush()
        httpd.serve_forever()

def run_https_server(port, certfile, keyfile):
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=certfile, keyfile=keyfile)
    with ThreadedHTTPServer(("", port), TranslationProxyHandler) as httpd:
        httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
        print(f" Servidor HTTPS multihilo activo en: https://0.0.0.0:{port}")
        sys.stdout.flush()
        httpd.serve_forever()

def run_server():
    cert_file = os.path.join(CERTS_DIR, "cert.pem")
    key_file = os.path.join(CERTS_DIR, "key.pem")

    print(f"==================================================")
    print(f" Traductor Local / Traductor con IA iniciando...")
    print(f" Conectado a LibreTranslate en: {LIBRETRANSLATE_HOST}")
    print(f" Soporte de IAs: Gemini, Claude, ChatGPT, DeepSeek")
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
