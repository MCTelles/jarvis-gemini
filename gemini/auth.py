import os

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

from .config import SCOPES

_creds_cache = None


def obter_credenciais():
    global _creds_cache
    if _creds_cache and _creds_cache.valid:
        return _creds_cache

    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)

    if creds and not set(SCOPES).issubset(set(creds.scopes or [])):
        creds = None
        os.remove("token.json")

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists("credentials.json"):
                raise FileNotFoundError("credentials.json não encontrado.")
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)
        with open("token.json", "w") as arquivo:
            arquivo.write(creds.to_json())

    _creds_cache = creds
    return creds
