"""
JARVIS — Backend FastAPI (Worker de IA)
=======================================
"""

import base64
import os
import time
import logging
import subprocess
import threading
import pyttsx3

from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from gemini import (
    GOOGLE_API_KEY,
    MAPS_API_KEY,
    analisar_imagem,
    enviar_mensagem,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("JARVIS")

# ==========================================
# TTS + MIC MUTE
# ==========================================
engine = None
_falando = False
_tts_lock = threading.Lock()

def _mic_volume(nivel: int):
    try:
        subprocess.run(["osascript", "-e", f"set volume input volume {nivel}"], capture_output=True, timeout=2)
    except Exception:
        pass

def falar(texto: str):
    global _falando, engine
    with _tts_lock:
        try:
            if engine is None:
                engine = pyttsx3.init()
                engine.setProperty("rate", 175)
                engine.setProperty("volume", 0.9)
            _falando = True
            _mic_volume(0)
            engine.say(texto)
            engine.runAndWait()
            time.sleep(0.9)
        finally:
            _mic_volume(100)
            _falando = False

# ==========================================
# FASTAPI APP
# ==========================================
app = FastAPI(title="JARVIS API")

class ItemHistorico(BaseModel):
    role: str
    content: str

class MensagemRequest(BaseModel):
    texto: str
    tts: bool = False
    historico: list[ItemHistorico] = Field(default_factory=list)


class AnaliseImagemRequest(BaseModel):
    prompt: str = "Analise esta imagem em detalhes."
    image_base64: str
    mime_type: str = "image/jpeg"
    file_name: str = "imagem.jpg"
    tts: bool = False
    historico: list[ItemHistorico] = Field(default_factory=list)


@app.post("/chat")
async def chat_endpoint(req: MensagemRequest):
    """Recebe mensagem e processa no contexto da conversa correta."""
    try:
        texto_resposta = enviar_mensagem(
            req.texto, [item.model_dump() for item in req.historico]
        )

        audio_b64 = None
        if req.tts:
            threading.Thread(target=falar, args=(texto_resposta,), daemon=True).start()

        return JSONResponse({"resposta": texto_resposta, "audio": audio_b64})
    except Exception as e:
        log.error(f"Erro no chat: {e}")
        raise HTTPException(status_code=500, detail="Não foi possível processar a mensagem.")


@app.post("/analyze-image")
async def analyze_image_endpoint(req: AnaliseImagemRequest):
    """Recebe imagem e prompt para análise com o Gemini."""
    try:
        image_bytes = base64.b64decode(req.image_base64)
        texto_resposta = analisar_imagem(
            prompt=req.prompt,
            image_bytes=image_bytes,
            mime_type=req.mime_type,
            file_name=req.file_name,
            historico=[item.model_dump() for item in req.historico],
            logger=log,
        )

        audio_b64 = None
        if req.tts:
            threading.Thread(target=falar, args=(texto_resposta,), daemon=True).start()

        return JSONResponse({"resposta": texto_resposta, "audio": audio_b64})
    except Exception as e:
        log.error(f"Erro na analise de imagem: {e}")
        raise HTTPException(status_code=500, detail="Não foi possível analisar a imagem.")

@app.get("/status")
async def status():
    return {
        "status": "online",
        "hora": datetime.now().strftime("%H:%M:%S"),
        "gemini": bool(GOOGLE_API_KEY),
        "maps": bool(MAPS_API_KEY),
        "google_auth": os.path.exists("token.json"),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend:app", host="127.0.0.1", port=8000, reload=True)
