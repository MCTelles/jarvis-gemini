import os
import sys

if __package__ in {None, ""}:
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    from gemini.config import GOOGLE_API_KEY, MAPS_API_KEY
    from gemini.service import analisar_imagem, apagar_conversa, enviar_mensagem
else:
    from .config import GOOGLE_API_KEY, MAPS_API_KEY
    from .service import analisar_imagem, apagar_conversa, enviar_mensagem

__all__ = [
    "GOOGLE_API_KEY",
    "MAPS_API_KEY",
    "enviar_mensagem",
    "apagar_conversa",
    "analisar_imagem",
]


def main():
    if len(sys.argv) < 2:
        print('Use `python3 -m gemini "sua mensagem"` para testar o pacote.')
        return

    texto = " ".join(sys.argv[1:])
    resposta = enviar_mensagem(texto, "cli")
    print(resposta)


if __name__ == "__main__":
    main()
