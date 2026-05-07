import logging

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


def enviar_mensagem(texto: str, conversation_id: str, logger: logging.Logger | None = None) -> str:
    if conversation_id not in _sessoes_chat:
        if logger:
            logger.info("Criando nova sessão de IA para a conversa: %s", conversation_id)
        _sessoes_chat[conversation_id] = _model.start_chat(
            enable_automatic_function_calling=True
        )

    chat_atual = _sessoes_chat[conversation_id]
    response = chat_atual.send_message(texto)
    return response.text


def apagar_conversa(conversation_id: str) -> bool:
    return _sessoes_chat.pop(conversation_id, None) is not None
