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

_sessoes_chat = {}


def _obter_chat(conversation_id: str, logger: logging.Logger | None = None):
    if conversation_id not in _sessoes_chat:
        if logger:
            logger.info("Criando nova sessão de IA para a conversa: %s", conversation_id)
        _sessoes_chat[conversation_id] = _model.start_chat(
            enable_automatic_function_calling=True
        )

    return _sessoes_chat[conversation_id]


def enviar_mensagem(texto: str, conversation_id: str, logger: logging.Logger | None = None) -> str:
    chat_atual = _obter_chat(conversation_id, logger=logger)
    response = chat_atual.send_message(texto)
    return response.text


def analisar_imagem(
    prompt: str,
    image_bytes: bytes,
    mime_type: str,
    file_name: str,
    conversation_id: str,
    logger: logging.Logger | None = None,
) -> str:
    chat_atual = _obter_chat(conversation_id, logger=logger)
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


def apagar_conversa(conversation_id: str) -> bool:
    return _sessoes_chat.pop(conversation_id, None) is not None
