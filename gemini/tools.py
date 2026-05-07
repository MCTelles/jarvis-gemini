import os
import re
import subprocess
from base64 import b64encode
from datetime import datetime, timedelta
from urllib.parse import quote

import requests as http_requests
from googleapiclient.discovery import build

from .auth import obter_credenciais
from .config import MAPS_API_KEY


def abrir_site(site: str) -> str:
    """Abre um site no navegador padrão. Args: site: nome do site ou termo de busca."""
    import webbrowser

    sites = {
        "youtube": "https://www.youtube.com",
        "github": "https://www.github.com",
        "whatsapp": "https://web.whatsapp.com",
        "google": "https://www.google.com",
        "gmail": "https://mail.google.com",
        "drive": "https://drive.google.com",
        "maps": "https://maps.google.com",
        "linkedin": "https://www.linkedin.com",
    }
    site_clean = site.lower().strip()
    if site_clean in sites:
        url = sites[site_clean]
    elif site_clean.startswith(("http://", "https://")):
        url = site_clean
    else:
        url = f"https://{site_clean}"
    webbrowser.open(url)
    return f"Abri '{site}' no navegador."


def criar_nota(conteudo: str, titulo: str = "") -> str:
    """Salva uma nota em arquivo local. Args: conteudo: texto da nota. titulo: título opcional."""
    pasta = "notas_salvas"
    os.makedirs(pasta, exist_ok=True)
    nome = re.sub(r"[^\w\s-]", "", titulo).strip().replace(" ", "_") if titulo else ""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(pasta, f"{nome}_{ts}.txt" if nome else f"nota_{ts}.txt")
    with open(path, "w", encoding="utf-8") as arquivo:
        if titulo:
            arquivo.write(f"{titulo}\n{'=' * len(titulo)}\n\n")
        arquivo.write(conteudo)
    return f"Nota salva em '{path}'."


def adicionar_evento_agenda(titulo: str, data_inicio_iso: str, duracao_minutos: int = 60) -> str:
    """Cria evento no Google Calendar. Args: titulo: nome do evento. data_inicio_iso: ISO 8601."""
    try:
        service = build("calendar", "v3", credentials=obter_credenciais())
        inicio = datetime.fromisoformat(data_inicio_iso)
        fim = inicio + timedelta(minutes=duracao_minutos)
        evento = {
            "summary": titulo,
            "start": {"dateTime": inicio.isoformat(), "timeZone": "America/Sao_Paulo"},
            "end": {"dateTime": fim.isoformat(), "timeZone": "America/Sao_Paulo"},
        }
        service.events().insert(calendarId="primary", body=evento).execute()
        return f"Evento '{titulo}' criado para {inicio.strftime('%d/%m/%Y às %H:%M')}."
    except Exception as exc:
        return f"Erro ao criar evento: {exc}"


def listar_proximos_eventos(quantidade: int = 5) -> str:
    """Lista próximos eventos do Google Calendar. Args: quantidade: número de eventos."""
    try:
        service = build("calendar", "v3", credentials=obter_credenciais())
        agora = datetime.utcnow().isoformat() + "Z"
        res = service.events().list(
            calendarId="primary",
            timeMin=agora,
            maxResults=quantidade,
            singleEvents=True,
            orderBy="startTime",
        ).execute()
        eventos = res.get("items", [])
        if not eventos:
            return "Nenhum evento próximo."
        resp = f"Próximos {len(eventos)} eventos:\n"
        for evento in eventos:
            inicio = evento["start"].get("dateTime", evento["start"].get("date", ""))
            try:
                dt = datetime.fromisoformat(inicio.replace("Z", "+00:00"))
                inicio_fmt = dt.strftime("%d/%m às %H:%M")
            except Exception:
                inicio_fmt = inicio
            resp += f"  • {inicio_fmt} — {evento.get('summary', 'Sem título')}\n"
        return resp
    except Exception as exc:
        return f"Erro ao listar eventos: {exc}"


def ler_ultimos_emails(quantidade: int = 5) -> str:
    """Lê e-mails não lidos do Gmail. Args: quantidade: número de e-mails."""
    try:
        service = build("gmail", "v1", credentials=obter_credenciais())
        res = service.users().messages().list(
            userId="me",
            labelIds=["INBOX", "UNREAD"],
            maxResults=quantidade,
        ).execute()
        msgs = res.get("messages", [])
        if not msgs:
            return "Nenhum e-mail não lido."
        resumo = f"Últimos {len(msgs)} e-mail(s) não lidos:\n"
        for msg in msgs:
            dados = service.users().messages().get(userId="me", id=msg["id"]).execute()
            headers = dados["payload"]["headers"]
            assunto = next((h["value"] for h in headers if h["name"] == "Subject"), "Sem assunto")
            remetente = next((h["value"] for h in headers if h["name"] == "From"), "Desconhecido")
            resumo += f"  • De: {remetente}\n    Assunto: {assunto}\n"
        return resumo
    except Exception as exc:
        return f"Erro ao acessar Gmail: {exc}"


def buscar_video_youtube(pesquisa: str) -> str:
    """Busca vídeo no YouTube e abre no navegador. Args: pesquisa: termo de busca."""
    try:
        service = build("youtube", "v3", credentials=obter_credenciais())
        res = service.search().list(part="snippet", maxResults=1, q=pesquisa, type="video").execute()
        itens = res.get("items", [])
        if not itens:
            return "Nenhum vídeo encontrado."

        import webbrowser

        video_id = itens[0]["id"]["videoId"]
        titulo = itens[0]["snippet"]["title"]
        webbrowser.open(f"https://www.youtube.com/watch?v={video_id}")
        return f"Abri o vídeo '{titulo}' no navegador."
    except Exception as exc:
        return f"Erro no YouTube: {exc}"


def pesquisar_musica_spotify(musica: str) -> str:
    """Abre no Spotify a primeira música encontrada para a busca."""
    termo = musica.strip()
    if not termo:
        return "Informe o nome de uma música para pesquisar no Spotify."

    faixa = _buscar_primeira_faixa_spotify(termo)
    if faixa:
        nome_faixa = faixa["nome"]
        artistas = ", ".join(faixa["artistas"])
        if _abrir_url_spotify(f"spotify:track:{faixa['id']}"):
            return f"Abri no Spotify a música '{nome_faixa}' de {artistas}."

        try:
            import webbrowser

            webbrowser.open(faixa["url"])
            return f"Não consegui abrir o app do Spotify, então abri a música '{nome_faixa}' de {artistas} no navegador."
        except Exception as exc:
            return f"Erro ao abrir a música no Spotify: {exc}"

    termo_codificado = quote(termo)
    app_url = f"spotify:search:{termo_codificado}"
    web_url = f"https://open.spotify.com/search/{termo_codificado}"

    if _abrir_url_spotify(app_url):
        return (
            f"Não encontrei uma faixa direta para '{termo}', então abri a busca no Spotify."
        )

    try:
        import webbrowser

        webbrowser.open(web_url)
        return f"Não consegui abrir o app do Spotify, então abri a busca no navegador para '{termo}'."
    except Exception as exc:
        return f"Erro ao abrir o Spotify: {exc}"


def _abrir_url_spotify(url: str) -> bool:
    try:
        resultado = subprocess.run(
            ["open", url],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return resultado.returncode == 0
    except Exception:
        return False


def _buscar_primeira_faixa_spotify(termo: str):
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    if not client_id or not client_secret:
        return None

    token = _obter_token_spotify(client_id, client_secret)
    if not token:
        return None

    try:
        response = http_requests.get(
            "https://api.spotify.com/v1/search",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "q": termo,
                "type": "track",
                "limit": 1,
                "market": "BR",
            },
            timeout=10,
        )
        if response.status_code != 200:
            return None

        itens = response.json().get("tracks", {}).get("items", [])
        if not itens:
            return None

        primeira = itens[0]
        return {
            "id": primeira["id"],
            "nome": primeira["name"],
            "artistas": [artista["name"] for artista in primeira.get("artists", [])],
            "url": primeira.get("external_urls", {}).get("spotify"),
        }
    except Exception:
        return None


def _obter_token_spotify(client_id: str, client_secret: str):
    credenciais = b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode("utf-8")
    try:
        response = http_requests.post(
            "https://accounts.spotify.com/api/token",
            headers={
                "Authorization": f"Basic {credenciais}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials"},
            timeout=10,
        )
        if response.status_code != 200:
            return None
        return response.json().get("access_token")
    except Exception:
        return None


def calcular_distancia(origem: str, destino: str) -> str:
    """Calcula distância e tempo via Google Maps."""
    if not MAPS_API_KEY:
        return "Erro: MAPS_API_KEY não configurada."

    url = (
        "https://maps.googleapis.com/maps/api/distancematrix/json"
        f"?origins={http_requests.utils.quote(origem)}"
        f"&destinations={http_requests.utils.quote(destino)}"
        f"&key={MAPS_API_KEY}&language=pt-BR"
    )
    try:
        dados = http_requests.get(url, timeout=10).json()
        if dados.get("status") != "OK":
            return f"Erro Maps: {dados.get('status')} — {dados.get('error_message', '')}"
        elemento = dados["rows"][0]["elements"][0]
        if elemento.get("status") != "OK":
            return f"Rota não encontrada. Status: {elemento.get('status')}"
        return (
            f"De '{origem}' até '{destino}': "
            f"{elemento['distance']['text']} — {elemento['duration']['text']}."
        )
    except Exception as exc:
        return f"Erro Maps: {exc}"


def obter_hora_atual() -> str:
    """Retorna a data e hora atual."""
    return datetime.now().strftime("Hoje é %A, %d de %B de %Y. Agora são %H:%M.")


def obter_clima(cidade: str) -> str:
    """Obtém o clima atual para uma cidade."""
    try:
        response = http_requests.get(
            f"https://wttr.in/{http_requests.utils.quote(cidade)}?format=3",
            timeout=10,
        )
        if response.status_code == 200:
            return response.text.strip()
        return f"Erro ao obter clima para '{cidade}'."
    except Exception as exc:
        return f"Erro ao obter clima: {exc}"


GEMINI_TOOLS = [
    abrir_site,
    criar_nota,
    adicionar_evento_agenda,
    listar_proximos_eventos,
    ler_ultimos_emails,
    buscar_video_youtube,
    pesquisar_musica_spotify,
    calcular_distancia,
    obter_hora_atual,
    obter_clima,
]
