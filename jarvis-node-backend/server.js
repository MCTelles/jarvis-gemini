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
const HOST = process.env.HOST || '127.0.0.1';
const PYTHON_SERVICE_URL =
	process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function imagemValida(bytes, mimeType) {
	if (mimeType === 'image/png') {
		return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
	}
	if (mimeType === 'image/jpeg') {
		return bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'));
	}
	return bytes.toString('ascii', 0, 4) === 'RIFF' &&
		bytes.toString('ascii', 8, 12) === 'WEBP';
}

// Configuração de conexão com o banco
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: '8mb' }));

async function obterHistorico(conversationId) {
	const messages = await prisma.message.findMany({
		where: { conversationId },
		orderBy: { id: 'desc' },
		take: 30,
		select: { role: true, content: true },
	});
	return messages.reverse();
}

async function salvarTroca(conversationId, texto, resposta, imageData = null) {
	await prisma.$transaction(async tx => {
		await tx.message.create({
			data: { role: 'user', content: texto, imageData, conversationId },
		});
		await tx.message.create({
			data: { role: 'ai', content: resposta, conversationId },
		});
		await tx.conversation.updateMany({
			where: { id: conversationId, title: 'Nova Conversa' },
			data: { title: `${texto.replace(/^\[Imagem\]\s*/, '').split(/\s+/).slice(0, 3).join(' ')}...` },
		});
	});
}

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
			orderBy: { id: 'asc' },
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
	const { texto, tts, conversationId } = req.body || {};

	if (typeof texto !== 'string' || !texto.trim() || !conversationId) {
		return res
			.status(400)
			.json({ erro: 'Texto e conversationId são obrigatórios.' });
	}

	try {
		const historico = await obterHistorico(conversationId);
		const pythonResponse = await axios.post(`${PYTHON_SERVICE_URL}/chat`, {
			texto: texto.trim(),
			tts: Boolean(tts),
			historico,
		});

		const respostaIA = pythonResponse.data.resposta;
		await salvarTroca(conversationId, texto.trim(), respostaIA);

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
	const { prompt, imageBase64, mimeType, fileName, tts, conversationId } = req.body || {};

	if (typeof imageBase64 !== 'string' || !imageBase64 || !conversationId) {
		return res
			.status(400)
			.json({ erro: 'imageBase64 e conversationId sao obrigatorios.' });
	}
	if (!IMAGE_TYPES.has(mimeType) || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
		return res.status(400).json({ erro: 'Formato de imagem inválido.' });
	}
	const imageBytes = Buffer.from(imageBase64, 'base64');
	if (!imageBytes.length || imageBytes.length > MAX_IMAGE_BYTES) {
		return res.status(400).json({ erro: 'A imagem deve ter até 5 MB.' });
	}
	if (!imagemValida(imageBytes, mimeType)) {
		return res.status(400).json({ erro: 'O conteúdo não corresponde ao tipo de imagem.' });
	}

	const promptFinal = typeof prompt === 'string' && prompt.trim()
		? prompt.trim()
		: 'Analise esta imagem em detalhes.';

	try {
		const historico = await obterHistorico(conversationId);
		const pythonResponse = await axios.post(`${PYTHON_SERVICE_URL}/analyze-image`, {
			prompt: promptFinal,
			image_base64: imageBase64,
			mime_type: mimeType,
			file_name: typeof fileName === 'string' ? fileName.slice(0, 120) : 'imagem',
			tts: Boolean(tts),
			historico,
		});

		const respostaIA = pythonResponse.data.resposta;
		await salvarTroca(
			conversationId,
			`[Imagem] ${promptFinal}`,
			respostaIA,
			`data:${mimeType};base64,${imageBase64}`,
		);

		res.json(pythonResponse.data);
	} catch (error) {
		console.error('[Node] Erro na analise de imagem:', error.message);
		res.status(502).json({ erro: 'Falha na comunicacao com a IA.' });
	}
});

app.listen(PORT, HOST, () => {
	console.log(`🚀 Orquestrador Node rodando em http://${HOST}:${PORT}`);
});
