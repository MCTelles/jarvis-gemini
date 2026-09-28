# JARVIS Gemini

Assistente pessoal desenvolvido como projeto de faculdade. A interface em React conversa com um backend Node.js, que salva as conversas no PostgreSQL e chama um serviço Python para usar o Gemini e ferramentas locais.

## O que faz

- Conversas por texto com histórico salvo no banco.
- Análise de imagens PNG, JPEG e WebP de até 5 MB. As imagens enviadas também aparecem no histórico.
- Ditado pelo navegador e leitura de respostas em voz no computador que executa o serviço Python.
- Ferramentas para notas locais, agenda e Gmail via OAuth, buscas no YouTube e Spotify, clima e distância.

```text
Navegador (React/Vite) → API Node/Express → PostgreSQL
                              ↓
                        Serviço Python/FastAPI → Gemini e ferramentas
```

O Node envia as 30 mensagens mais recentes ao serviço Python a cada solicitação. Assim, o contexto recente continua disponível após reiniciar o serviço. Mensagens e imagens ficam no PostgreSQL; o serviço Python não guarda sessões de conversa em memória.

## Requisitos

- Node.js 22.13+ ou 24+
- Python 3.10+
- PostgreSQL ou Docker para iniciar o banco local de exemplo
- Chave de API do Gemini

As integrações Google, Maps e Spotify exigem credenciais próprias. O chat por texto e a análise de imagens funcionam sem configurar essas integrações adicionais.

## Executar localmente

1. Clone o repositório e configure os exemplos de ambiente:

   ```bash
   git clone https://github.com/MCTelles/jarvis-gemini.git
   cd jarvis-gemini
   cp .env.example .env
   cp jarvis-node-backend/.env.example jarvis-node-backend/.env
   cp jarvis-frontend/.env.example jarvis-frontend/.env
   ```

2. Coloque sua chave em `GOOGLE_API_KEY` no `.env` da raiz. Ajuste `DATABASE_URL` em `jarvis-node-backend/.env` para seu PostgreSQL. Para usar o banco local do projeto, execute `docker compose up -d db` e mantenha a URL do exemplo.

3. Instale as dependências e prepare o banco:

   ```bash
   cd jarvis-frontend && npm ci && cd ..
   cd jarvis-node-backend && npm ci && npx prisma generate && npx prisma db push && cd ..
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

4. Em três terminais, inicie os serviços nesta ordem:

   ```bash
   # Terminal 1, na raiz do projeto, com o ambiente Python ativado
   python3 backend.py

   # Terminal 2
   cd jarvis-node-backend && npm run dev

   # Terminal 3
   cd jarvis-frontend && npm run dev
   ```

5. Abra [http://localhost:5173](http://localhost:5173), crie uma conversa e envie uma mensagem.

Se não usar Docker, crie um banco PostgreSQL e informe sua URL em `DATABASE_URL` antes de executar o Prisma. Para testar uma mensagem sem a interface, use `python3 -m gemini "olá"` com o ambiente Python ativado.

## Integrações opcionais

- **Google Calendar, Gmail e YouTube:** coloque seu `credentials.json` OAuth na raiz. A primeira chamada a uma dessas ferramentas abre a autorização e gera um `token.json` local. Esses arquivos são ignorados pelo Git. As permissões solicitadas estão em `gemini/config.py`.
- **Maps:** configure `MAPS_API_KEY` no `.env` da raiz.
- **Spotify:** configure `SPOTIFY_CLIENT_ID` e `SPOTIFY_CLIENT_SECRET` para abrir a primeira faixa encontrada. Sem essas credenciais, a busca abre no navegador.
- **Voz:** o ditado depende do suporte do navegador à Web Speech API. A leitura em voz ocorre no computador que executa o Python; o controle do volume do microfone usa `osascript` no macOS.

## Limites e cuidados

Este é um aplicativo pessoal para execução **local**. Node e Python escutam em `127.0.0.1`, e o Node aceita a origem do frontend configurada em `FRONTEND_ORIGIN`. Não publique essas APIs na internet sem adicionar autenticação e autorização às ferramentas. O assistente pode executar ações locais e acessar dados das contas que você conectar.

As imagens são guardadas como dados base64 no banco para manter o histórico visual. Isso simplifica o exemplo, mas aumenta o tamanho do banco; para um uso maior, seria melhor usar armazenamento de arquivos. O contexto enviado ao modelo é limitado às 30 mensagens mais recentes. Chamadas à API do Gemini e às integrações externas podem gerar custos ou depender de cotas da sua conta.

## Estrutura

| Caminho | Responsabilidade |
| --- | --- |
| `jarvis-frontend/` | Interface React e Vite |
| `jarvis-node-backend/` | API Express, persistência Prisma e PostgreSQL |
| `backend.py` | API FastAPI local para IA e voz |
| `gemini/` | Integração com Gemini e ferramentas |

## Verificações

```bash
cd jarvis-frontend && npm run lint && npm run build
cd ../jarvis-node-backend && npx prisma validate
cd .. && python3 -m compileall -q backend.py gemini
```
