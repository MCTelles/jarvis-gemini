import os
from pathlib import Path


def _load_local_env():
    raiz_projeto = Path(__file__).resolve().parent.parent
    env_path = raiz_projeto / ".env"
    if not env_path.exists():
        return

    for linha in env_path.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue

        chave, valor = linha.split("=", 1)
        chave = chave.strip()
        valor = valor.strip().strip('"').strip("'")
        if chave and chave not in os.environ:
            os.environ[chave] = valor


_load_local_env()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
MAPS_API_KEY = os.getenv("MAPS_API_KEY", "")

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/youtube.readonly",
]

SYSTEM_INSTRUCTION = (
    "Você é JARVIS, um assistente pessoal inteligente, direto e eficiente. "
    "Responda sempre em português do Brasil. Seja conciso e execute as ferramentas quando necessário. "
)
