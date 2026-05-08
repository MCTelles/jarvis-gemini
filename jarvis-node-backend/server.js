const express = require('express');
const cors = require('cors');
const axios = require('axios');

// Importações novas para o Prisma 7
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const PYTHON_SERVICE_URL =
	process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// Configuração de conexão com o banco
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// ==========================================
// ROTA 1: Status
// ==========================================
app.get('/api/status', (req, res) => {
	res.json({ service: 'Node Orquestrador', status: 'Online' });
});

// ==========================================
// ROTA 2: Listar todas as Conversas (Para o menu lateral)
// ==========================================
app.get('/api/conversations', async (req, res) => {
	try {
		const conversations = await prisma.conversation.findMany({
			orderBy: { createdAt: 'desc' },
		});
		res.json(conversations);
	} catch (error) {
		res.status(500).json({ erro: 'Erro ao listar conversas.' });
	}
});

// ==========================================
// ROTA 3: Criar uma Nova Conversa
// ==========================================
app.post('/api/conversations', async (req, res) => {
	try {
		const novaConversa = await prisma.conversation.create({
			data: { title: 'Nova Conversa' },
		});
		res.json(novaConversa);
	} catch (error) {
		res.status(500).json({ erro: 'Erro ao criar conversa.' });
	}
});

// ==========================================
// ROTA 4: Buscar o Histórico de UMA Conversa Específica
// ==========================================
app.get('/api/conversations/:id/messages', async (req, res) => {
	try {
		const messages = await prisma.message.findMany({
			where: { conversationId: req.params.id },
			orderBy: { createdAt: 'asc' },
		});
		res.json(messages);
	} catch (error) {
		res.status(500).json({ erro: 'Erro ao buscar mensagens.' });
	}
});

// ==========================================
// ROTA 5: Apagar uma conversa
// ==========================================
app.delete('/api/conversations/:id', async (req, res) => {
	const { id } = req.params;

	try {
		const conversation = await prisma.conversation.findUnique({
			where: { id },
		});

		if (!conversation) {
			return res.status(404).json({ erro: 'Conversa não encontrada.' });
		}

		await prisma.conversation.delete({
			where: { id },
		});

		try {
			await axios.delete(`${PYTHON_SERVICE_URL}/conversations/${id}`);
		} catch (pythonError) {
			console.warn(
				'[Node] Conversa apagada no banco, mas falhou ao limpar memória no Python:',
				pythonError.message,
			);
		}

		res.json({ ok: true, id });
	} catch (error) {
		console.error('[Node] Erro ao apagar conversa:', error.message);
		res.status(500).json({ erro: 'Erro ao apagar conversa.' });
	}
});

// ==========================================
// ROTA 6: Chat Principal (Agora recebe conversationId)
// ==========================================
app.post('/api/chat', async (req, res) => {
	const { texto, tts, conversationId } = req.body;

	if (!texto || !conversationId) {
		return res
			.status(400)
			.json({ erro: 'Texto e conversationId são obrigatórios.' });
	}

	try {
		// 1. Salva a mensagem do usuário vinculada à conversa
		await prisma.message.create({
			data: { role: 'user', content: texto, conversationId },
		});

		// 2. Envia para o Python (agora passando o ID da conversa para ele isolar a memória)
		const pythonResponse = await axios.post(`${PYTHON_SERVICE_URL}/chat`, {
			texto: texto,
			tts: tts || false,
			conversation_id: conversationId, // Passando o ID pro Python
		});

		const respostaIA = pythonResponse.data.resposta;

		// 3. Salva a resposta da IA na mesma conversa
		await prisma.message.create({
			data: { role: 'ai', content: respostaIA, conversationId },
		});

		// 4. (Opcional) Atualiza o título da conversa baseado na primeira mensagem
		// Aqui pegamos as 3 primeiras palavras do usuário para o título
		await prisma.conversation.update({
			where: { id: conversationId },
			data: { title: texto.split(' ').slice(0, 3).join(' ') + '...' },
		});

		res.json(pythonResponse.data);
	} catch (error) {
		console.error('[Node] Erro na comunicação:', error.message);
		res.status(502).json({ erro: 'Falha na comunicação com a IA.' });
	}
});

// ==========================================
// ROTA 7: Analise de imagem com Gemini
// ==========================================
app.post('/api/image-analysis', async (req, res) => {
	const { prompt, imageBase64, mimeType, fileName, tts, conversationId } = req.body;

	if (!imageBase64 || !conversationId) {
		return res
			.status(400)
			.json({ erro: 'imageBase64 e conversationId sao obrigatorios.' });
	}

	const promptFinal = prompt?.trim() || 'Analise esta imagem em detalhes.';

	try {
		await prisma.message.create({
			data: {
				role: 'user',
				content: `[Imagem] ${promptFinal}`,
				conversationId,
			},
		});

		const pythonResponse = await axios.post(`${PYTHON_SERVICE_URL}/analyze-image`, {
			prompt: promptFinal,
			image_base64: imageBase64,
			mime_type: mimeType || 'image/jpeg',
			file_name: fileName || 'imagem.jpg',
			tts: tts || false,
			conversation_id: conversationId,
		});

		const respostaIA = pythonResponse.data.resposta;

		await prisma.message.create({
			data: { role: 'ai', content: respostaIA, conversationId },
		});

		await prisma.conversation.update({
			where: { id: conversationId },
			data: { title: promptFinal.split(' ').slice(0, 3).join(' ') + '...' },
		});

		res.json(pythonResponse.data);
	} catch (error) {
		console.error('[Node] Erro na analise de imagem:', error.message);
		res.status(502).json({ erro: 'Falha na comunicacao com a IA.' });
	}
});

app.listen(PORT, () => {
	console.log(`🚀 Orquestrador Node rodando na porta ${PORT}`);
});
