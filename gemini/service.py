import logging
from io import BytesIO

import google.generativeai as genai

from .config import GOOGLE_API_KEY, SYSTEM_INSTRUCTION
from .tools import GEMINI_TOOLS

if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)

_model = genai.GenerativeModel(
    model_name="gemini-2.5-flash",
    tools=GEMINI_TOOLS,
    system_instruction=SYSTEM_INSTRUCTION,
)

def _obter_chat(historico: list[dict[str, str]]):
    """Recria o contexto a partir do histórico persistido pelo backend Node."""
    mensagens = [
        {
            "role": "model" if item["role"] == "ai" else "user",
            "parts": [item["content"]],
        }
        for item in historico
        if item.get("role") in {"user", "ai"} and item.get("content")
    ]
    return _model.start_chat(
        history=mensagens,
        enable_automatic_function_calling=True,
    )


def enviar_mensagem(texto: str, historico: list[dict[str, str]]) -> str:
    chat_atual = _obter_chat(historico)
    response = chat_atual.send_message(texto)
    return response.text


def analisar_imagem(
    prompt: str,
    image_bytes: bytes,
    mime_type: str,
    file_name: str,
    historico: list[dict[str, str]],
    logger: logging.Logger | None = None,
) -> str:
    chat_atual = _obter_chat(historico)
    arquivo = None

    try:
        buffer = BytesIO(image_bytes)
        buffer.name = file_name or "imagem"
        arquivo = genai.upload_file(buffer, mime_type=mime_type, display_name=file_name)
        response = chat_atual.send_message([arquivo, prompt])
    finally:
        if arquivo:
            try:
                genai.delete_file(arquivo.name)
            except Exception:
                if logger:
                    logger.warning("Nao foi possivel apagar o arquivo temporario do Gemini.")

    return response.text
