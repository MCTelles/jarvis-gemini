# JARVIS Gemini

Projeto da faculdade com interface web, backend Node.js e serviço Python integrado ao Gemini.

## Arquitetura

- `jarvis-frontend/`: interface React + Vite.
- `jarvis-node-backend/`: backend Node.js com Express, Prisma e PostgreSQL.
- `backend.py`: serviço Python com FastAPI.
- `gemini/`: módulo com integração Gemini, ferramentas e memória das conversas.

Fluxo da aplicação:

1. O frontend envia a mensagem para o backend Node.
2. O backend Node salva a conversa e as mensagens no banco.
3. O backend Node chama o serviço Python.
4. O serviço Python conversa com o Gemini e devolve a resposta.
5. O backend Node salva a resposta e retorna para o frontend.

## Requisitos

- Node.js 18+
- Python 3.10+
- PostgreSQL

## Configuração

### 1. Clonar o projeto

```bash
git clone https://github.com/MCTelles/jarvis-gemini.git
cd jarvis-gemini
```

### 2. Configurar variáveis do Python

Crie um arquivo `.env` na raiz com base em `.env.example`.

```bash
cp .env.example .env
```

Preencha:

- `GOOGLE_API_KEY`
- `MAPS_API_KEY`
- `SPOTIFY_CLIENT_ID` e `SPOTIFY_CLIENT_SECRET` se quiser abrir direto a primeira música encontrada

### 3. Configurar variáveis do backend Node

Crie `jarvis-node-backend/.env` com base em `jarvis-node-backend/.env.example`.

```bash
cp jarvis-node-backend/.env.example jarvis-node-backend/.env
```

Preencha principalmente:

- `DATABASE_URL`
- `PORT`
- `PYTHON_SERVICE_URL`

### 4. OAuth do Google

Este projeto usa autenticação Google para recursos como Gmail, Calendar e YouTube.

- O arquivo `credentials.json` não deve ser enviado ao GitHub.
- Cada integrante deve ter acesso ao client OAuth cadastrado.
- Na primeira execução do backend Python, cada pessoa vai autenticar sua própria conta e gerar seu próprio `token.json`.
- O arquivo `token.json` também não deve ser enviado ao GitHub.

## Instalação

### Frontend

```bash
cd jarvis-frontend
npm install
```

### Backend Node

```bash
cd jarvis-node-backend
npm install
```

### Backend Python

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Banco de dados

O backend Node usa Prisma com PostgreSQL.

Depois de configurar o `DATABASE_URL`, gere o client e aplique o schema:

```bash
cd jarvis-node-backend
npx prisma generate
npx prisma db push
```

## Como rodar

Abra 3 terminais.

### Terminal 1: serviço Python

```bash
cd /caminho/para/jarvis-gemini
source .venv/bin/activate
python3 backend.py
```

O serviço sobe por padrão em `http://localhost:8000`.

### Terminal 2: backend Node

```bash
cd /caminho/para/jarvis-gemini/jarvis-node-backend
npm run dev
```

O backend sobe por padrão em `http://localhost:3001`.

### Terminal 3: frontend

```bash
cd /caminho/para/jarvis-gemini/jarvis-frontend
npm install
npm run dev
```

O frontend normalmente sobe em `http://localhost:5173`.

## Funcionalidades atuais

- criação de conversas
- histórico salvo em banco
- exclusão de conversas
- integração com Gemini
- abertura de sites
- notas locais
- agenda Google
- leitura de e-mails
- busca de vídeo no YouTube
- busca de música no Spotify
- clima e distância
- TTS por voz no macOS

## O que subir no GitHub

Pode subir:

- código-fonte
- `README.md`
- `.env.example`
- `jarvis-node-backend/.env.example`
- `package.json`, `package-lock.json`
- `requirements.txt`

Não deve subir:

- `.env`
- `credentials.json`
- `token.json`
- `node_modules`
- `.venv`
- arquivos pessoais em `notas_salvas/`

## Checklist para os colegas testarem

1. Clonar o repositório.
2. Criar `.env` na raiz.
3. Criar `jarvis-node-backend/.env`.
4. Instalar dependências do frontend.
5. Instalar dependências do backend Node.
6. Criar ambiente virtual e instalar dependências Python.
7. Configurar o PostgreSQL.
8. Rodar `npx prisma db push`.
9. Subir Python, Node e frontend.
10. Fazer login Google na primeira execução, se forem usar integrações OAuth.

## Git

Para iniciar o repositório e publicar:

```bash
git init
git add .
git commit -m "feat: estrutura inicial do jarvis gemini"
git branch -M main
git remote add origin https://github.com/MCTelles/jarvis-gemini.git
git push -u origin main
```
