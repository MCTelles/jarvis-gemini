"""
JARVIS — Backend FastAPI (Worker de IA)
=======================================
"""

import os
import time
import logging
import subprocess
import threading
import pyttsx3

from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from gemini import GOOGLE_API_KEY, MAPS_API_KEY, apagar_conversa, enviar_mensagem

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("JARVIS")

# ==========================================
# TTS + MIC MUTE
# ==========================================
engine = pyttsx3.init()
engine.setProperty("rate", 175)
engine.setProperty("volume", 0.9)
_falando = False
_tts_lock = threading.Lock()

def _mic_volume(nivel: int):
    try:
        subprocess.run(["osascript", "-e", f"set volume input volume {nivel}"], capture_output=True, timeout=2)
    except Exception:
        pass

def falar(texto: str):
    global _falando
    with _tts_lock:
        try:
            _falando = True
            _mic_volume(0)
            engine.say(texto)
            engine.runAndWait()
            time.sleep(0.9)
            _mic_volume(100)
        finally:
            _falando = False

# ==========================================
# FASTAPI APP
# ==========================================
app = FastAPI(title="JARVIS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class MensagemRequest(BaseModel):
    texto: str
    tts: bool = False
    conversation_id: str = "default"

@app.post("/chat")
async def chat_endpoint(req: MensagemRequest):
    """Recebe mensagem e processa no contexto da conversa correta."""
    try:
        texto_resposta = enviar_mensagem(req.texto, req.conversation_id, logger=log)

        audio_b64 = None
        if req.tts:
            threading.Thread(target=falar, args=(texto_resposta,), daemon=True).start()

        return JSONResponse({"resposta": texto_resposta, "audio": audio_b64})
    except Exception as e:
        log.error(f"Erro no chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status")
async def status():
    return {
        "status": "online",
        "hora": datetime.now().strftime("%H:%M:%S"),
        "gemini": bool(GOOGLE_API_KEY),
        "maps": bool(MAPS_API_KEY),
        "google_auth": os.path.exists("token.json"),
    }


@app.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    conversa_apagada = apagar_conversa(conversation_id)
    return {"ok": True, "conversation_id": conversation_id, "cleared": conversa_apagada}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend:app", host="0.0.0.0", port=8000, reload=True)
