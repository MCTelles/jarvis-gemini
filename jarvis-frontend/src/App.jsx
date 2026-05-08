import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
	Send,
	Mic,
	Volume2,
	VolumeX,
	Plus,
	MessageSquare,
	Trash2,
	Image,
	X,
} from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

export default function App() {
	const [conversations, setConversations] = useState([]);
	const [activeChatId, setActiveChatId] = useState(null);
	const [messages, setMessages] = useState([]);
	const [input, setInput] = useState('');
	const [isTyping, setIsTyping] = useState(false);
	const [ttsActive, setTtsActive] = useState(false);
	const [isRecording, setIsRecording] = useState(false);
	const [selectedImage, setSelectedImage] = useState(null);
	const [imagePreview, setImagePreview] = useState('');

	const chatRef = useRef(null);
	const recognitionRef = useRef(null);
	const fileInputRef = useRef(null);

	// 1. Ao iniciar, carrega a lista de conversas
	useEffect(() => {
		carregarConversas();
		configurarReconhecimentoVoz();
	}, []);

	// 2. Sempre que a conversa ativa mudar, busca as mensagens dela
	useEffect(() => {
		if (activeChatId) {
			carregarMensagens(activeChatId);
		} else {
			setMessages([]);
		}
	}, [activeChatId]);

	// 3. Rola o chat para baixo sempre que chegar mensagem nova
	useEffect(() => {
		if (chatRef.current) {
			chatRef.current.scrollTop = chatRef.current.scrollHeight;
		}
	}, [messages, isTyping]);

	const carregarConversas = async () => {
		try {
			const res = await axios.get(`${API_URL}/conversations`);
			setConversations(res.data);
			// Se tiver conversas e nenhuma ativa, abre a primeira
			if (res.data.length > 0 && !activeChatId) {
				setActiveChatId(res.data[0].id);
			}
		} catch (error) {
			console.error('Erro ao carregar conversas', error);
		}
	};

	const carregarMensagens = async id => {
		try {
			const res = await axios.get(`${API_URL}/conversations/${id}/messages`);
			setMessages(res.data);
		} catch (error) {
			console.error('Erro ao carregar mensagens', error);
		}
	};

	const novaConversa = async () => {
		try {
			const res = await axios.post(`${API_URL}/conversations`);
			const nova = res.data;
			setConversations([nova, ...conversations]); // Coloca no topo da lista
			setActiveChatId(nova.id);
		} catch (error) {
			console.error('Erro ao criar conversa', error);
		}
	};

	const apagarConversa = async id => {
		try {
			await axios.delete(`${API_URL}/conversations/${id}`);

			const conversasAtualizadas = conversations.filter(conv => conv.id !== id);
			setConversations(conversasAtualizadas);

			if (activeChatId === id) {
				setActiveChatId(conversasAtualizadas[0]?.id || null);
				setMessages([]);
			}
		} catch (error) {
			console.error('Erro ao apagar conversa', error);
		}
	};

	const configurarReconhecimentoVoz = () => {
		const SpeechRecognition =
			window.SpeechRecognition || window.webkitSpeechRecognition;
		if (SpeechRecognition) {
			const recognition = new SpeechRecognition();
			recognition.lang = 'pt-BR';
			recognition.continuous = false;
			recognition.interimResults = false;

			recognition.onresult = e => enviarMensagem(e.results[0][0].transcript);
			recognition.onerror = () => setIsRecording(false);
			recognition.onend = () => setIsRecording(false);
			recognitionRef.current = recognition;
		}
	};

	const toggleMic = () => {
		if (isRecording) {
			recognitionRef.current?.stop();
		} else {
			recognitionRef.current?.start();
			setIsRecording(true);
		}
	};

	const limparImagemSelecionada = () => {
		setSelectedImage(null);
		setImagePreview('');
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
	};

	const selecionarImagem = e => {
		const arquivo = e.target.files?.[0];
		if (!arquivo) return;

		setSelectedImage(arquivo);

		const reader = new FileReader();
		reader.onload = evento => {
			setImagePreview(evento.target?.result || '');
		};
		reader.readAsDataURL(arquivo);
	};

	const arquivoParaBase64 = arquivo =>
		new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const resultado = reader.result;
				if (typeof resultado !== 'string') {
					reject(new Error('Falha ao ler a imagem.'));
					return;
				}

				const [, base64] = resultado.split(',');
				resolve(base64 || '');
			};
			reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
			reader.readAsDataURL(arquivo);
		});

	const enviarMensagem = async textoOverride => {
		const texto = textoOverride || input;
		const prompt = texto.trim() || 'Analise esta imagem em detalhes.';
		if ((!texto.trim() && !selectedImage) || !activeChatId) return;

		const novaMensagem = {
			id: Date.now(),
			role: 'user',
			content: prompt,
			createdAt: new Date(),
			imageUrl: imagePreview || null,
		};
		setMessages(prev => [...prev, novaMensagem]);
		setInput('');
		setIsTyping(true);

		try {
			let res;
			if (selectedImage) {
				const imageBase64 = await arquivoParaBase64(selectedImage);
				res = await axios.post(`${API_URL}/image-analysis`, {
					prompt,
					imageBase64,
					mimeType: selectedImage.type || 'image/jpeg',
					fileName: selectedImage.name,
					tts: ttsActive,
					conversationId: activeChatId,
				});
			} else {
				res = await axios.post(`${API_URL}/chat`, {
					texto: texto,
					tts: ttsActive,
					conversationId: activeChatId,
				});
			}

			setMessages(prev => [
				...prev,
				{
					id: Date.now() + 1,
					role: 'ai',
					content: res.data.resposta,
					createdAt: new Date(),
				},
			]);

			limparImagemSelecionada();
			carregarConversas();
		} catch (error) {
			setMessages(prev => [
				...prev,
				{
					id: Date.now() + 1,
					role: 'ai',
					content: '⚠️ Erro de conexão.',
					createdAt: new Date(),
				},
			]);
		} finally {
			limparImagemSelecionada();
			setIsTyping(false);
		}
	};

	const handleKeyDown = e => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			enviarMensagem();
		}
	};

	return (
		<>
			{/* Bordas decorativas */}
			<div className="corner corner-tl"></div>
			<div className="corner corner-tr"></div>
			<div className="corner corner-bl"></div>
			<div className="corner corner-br"></div>

			<div
				id="app"
				style={{
					display: 'flex',
					height: '100vh',
					width: '100vw',
					overflow: 'hidden',
				}}
			>
				{/* ========================================== */}
				{/* SIDEBAR (MENU LATERAL) */}
				{/* ========================================== */}
				<div
					style={{
						width: '260px',
						background: 'var(--panel)',
						borderRight: '1px solid var(--border)',
						display: 'flex',
						flexDirection: 'column',
						padding: '16px',
						zIndex: 10,
					}}
				>
					{/* Logo Jarvis */}
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '12px',
							marginBottom: '30px',
						}}
					>
						<div
							style={{
								width: 32,
								height: 32,
								borderRadius: '50%',
								border: '2px solid var(--accent)',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								boxShadow: '0 0 10px rgba(0,212,255,0.2)',
							}}
						>
							<div
								style={{
									width: 10,
									height: 10,
									background: 'var(--accent)',
									borderRadius: '50%',
								}}
							></div>
						</div>
						<h1
							style={{
								fontFamily: 'var(--mono)',
								fontSize: 18,
								letterSpacing: 4,
								color: 'var(--accent)',
								margin: 0,
							}}
						>
							JARVIS
						</h1>
					</div>

					<button
						onClick={novaConversa}
						style={{
							background: 'linear-gradient(135deg, #003060, #001840)',
							border: '1px solid rgba(0,212,255,0.3)',
							color: 'var(--accent)',
							padding: '12px',
							borderRadius: '6px',
							display: 'flex',
							alignItems: 'center',
							gap: '10px',
							cursor: 'pointer',
							marginBottom: '20px',
							fontFamily: 'var(--sans)',
							fontSize: 15,
							fontWeight: 600,
						}}
					>
						<Plus size={18} /> Nova Conversa
					</button>

					{/* Lista de Conversas */}
					<div
						style={{
							flex: 1,
							overflowY: 'auto',
							display: 'flex',
							flexDirection: 'column',
							gap: '8px',
						}}
					>
						{conversations.map(conv => (
							<div
								key={conv.id}
								onClick={() => setActiveChatId(conv.id)}
								style={{
									padding: '12px',
									borderRadius: '6px',
									cursor: 'pointer',
									display: 'flex',
									alignItems: 'center',
									gap: '10px',
									background:
										activeChatId === conv.id ? 'var(--user-bg)' : 'transparent',
									border:
										activeChatId === conv.id
											? '1px solid var(--border)'
											: '1px solid transparent',
									color:
										activeChatId === conv.id
											? 'var(--text)'
											: 'var(--text-dim)',
									transition: 'all 0.2s',
								}}
							>
								<MessageSquare size={16} style={{ flexShrink: 0 }} />
								<span
									style={{
										fontSize: 14,
										whiteSpace: 'nowrap',
										overflow: 'hidden',
										textOverflow: 'ellipsis',
									}}
								>
									{conv.title}
								</span>
								<button
									onClick={e => {
										e.stopPropagation();
										apagarConversa(conv.id);
									}}
									title="Apagar conversa"
									aria-label={`Apagar conversa ${conv.title}`}
									style={{
										marginLeft: 'auto',
										background: 'transparent',
										border: 'none',
										color: 'var(--text-dim)',
										cursor: 'pointer',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										padding: 0,
										flexShrink: 0,
									}}
								>
									<Trash2 size={15} />
								</button>
							</div>
						))}
					</div>
				</div>

				{/* ========================================== */}
				{/* ÁREA DE CHAT PRINCIPAL */}
				{/* ========================================== */}
				<div
					style={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						padding: '0 30px',
						maxWidth: '900px',
						margin: '0 auto',
						position: 'relative',
						zIndex: 2,
					}}
				>
					<div
						ref={chatRef}
						style={{
							flex: 1,
							overflowY: 'auto',
							padding: '24px 0',
							display: 'flex',
							flexDirection: 'column',
							gap: 16,
						}}
					>
						{messages.length === 0 && !isTyping ? (
							<div
								style={{
									textAlign: 'center',
									padding: '60px 20px',
									opacity: 0.5,
									margin: 'auto',
								}}
							>
								<h2
									style={{
										fontFamily: 'var(--mono)',
										fontSize: 14,
										letterSpacing: 4,
										color: 'var(--accent)',
										marginBottom: 12,
									}}
								>
									// SISTEMAS ONLINE
								</h2>
								<p
									style={{
										fontSize: 13,
										color: 'var(--text-dim)',
										letterSpacing: 1,
									}}
								>
									Crie uma nova conversa ou selecione no menu.
								</p>
							</div>
						) : (
							messages.map(msg => (
								<div
									key={msg.id}
									style={{
										display: 'flex',
										gap: 12,
										animation: 'fadeUp 0.3s ease forwards',
										flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
									}}
								>
									<div
										style={{
											width: 32,
											height: 32,
											borderRadius: 6,
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											fontFamily: 'var(--mono)',
											fontSize: 11,
											background:
												msg.role === 'ai'
													? 'linear-gradient(135deg, #001830, #003060)'
													: 'linear-gradient(135deg, #1a0a20, #2a1040)',
											border:
												msg.role === 'ai'
													? '1px solid rgba(0,212,255,0.3)'
													: '1px solid rgba(100,0,255,0.3)',
											color: msg.role === 'ai' ? 'var(--accent)' : '#9966ff',
											flexShrink: 0,
										}}
									>
										{msg.role === 'ai' ? 'AI' : 'EU'}
									</div>
									<div
										style={{
											maxWidth: '75%',
											padding: '12px 16px',
											borderRadius: 4,
											fontSize: 15,
											lineHeight: 1.6,
											background:
												msg.role === 'ai' ? 'var(--ai-bg)' : 'var(--user-bg)',
											border: '1px solid var(--border)',
											borderLeft:
												msg.role === 'ai'
													? '2px solid var(--accent)'
													: '1px solid var(--border)',
											borderRight:
												msg.role === 'user'
													? '2px solid #6633ff'
													: '1px solid var(--border)',
											color: msg.role === 'ai' ? 'var(--text)' : '#c8b8f5',
										}}
									>
										<span
											dangerouslySetInnerHTML={{
												__html: msg.content.replace(/\n/g, '<br/>'),
											}}
										/>
										{msg.imageUrl && (
											<img
												src={msg.imageUrl}
												alt="Imagem enviada para analise"
												style={{
													display: 'block',
													marginTop: 12,
													maxWidth: '100%',
													borderRadius: 4,
													border: '1px solid var(--border)',
												}}
											/>
										)}
									</div>
								</div>
							))
						)}

						{/* Indicador de Digitação */}
						{isTyping && (
							<div
								style={{
									display: 'flex',
									gap: 12,
									animation: 'fadeUp 0.3s ease forwards',
								}}
							>
								<div
									style={{
										width: 32,
										height: 32,
										borderRadius: 6,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										fontFamily: 'var(--mono)',
										fontSize: 11,
										background: 'linear-gradient(135deg, #001830, #003060)',
										border: '1px solid rgba(0,212,255,0.3)',
										color: 'var(--accent)',
									}}
								>
									AI
								</div>
								<div
									style={{
										padding: '14px 18px',
										background: 'var(--ai-bg)',
										border: '1px solid var(--border)',
										borderLeft: '2px solid var(--accent)',
										display: 'flex',
										alignItems: 'center',
										gap: 4,
									}}
								>
									<span
										style={{
											width: 6,
											height: 6,
											background: 'var(--accent)',
											borderRadius: '50%',
											animation: 'bounce 1.2s ease-in-out infinite',
										}}
									></span>
									<span
										style={{
											width: 6,
											height: 6,
											background: 'var(--accent)',
											borderRadius: '50%',
											animation: 'bounce 1.2s ease-in-out infinite',
											animationDelay: '0.2s',
										}}
									></span>
									<span
										style={{
											width: 6,
											height: 6,
											background: 'var(--accent)',
											borderRadius: '50%',
											animation: 'bounce 1.2s ease-in-out infinite',
											animationDelay: '0.4s',
										}}
									></span>
								</div>
							</div>
						)}
					</div>

					<footer
						style={{
							padding: '16px 0 24px',
							borderTop: '1px solid var(--border)',
						}}
					>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
							onChange={selecionarImagem}
							style={{ display: 'none' }}
						/>
						{imagePreview && (
							<div
								style={{
									marginBottom: 12,
									display: 'inline-flex',
									alignItems: 'center',
									gap: 12,
									padding: 10,
									border: '1px solid var(--border)',
									background: 'var(--panel)',
									borderRadius: 6,
								}}
							>
								<img
									src={imagePreview}
									alt="Preview da imagem"
									style={{
										width: 60,
										height: 60,
										objectFit: 'cover',
										borderRadius: 4,
										border: '1px solid var(--border)',
									}}
								/>
								<div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
									{selectedImage?.name || 'Imagem pronta para analise'}
								</div>
								<button
									onClick={limparImagemSelecionada}
									style={{
										marginLeft: 'auto',
										background: 'transparent',
										border: 'none',
										color: 'var(--text-dim)',
										cursor: 'pointer',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
									}}
								>
									<X size={16} />
								</button>
							</div>
						)}
						<div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
							<button
								onClick={() => setTtsActive(!ttsActive)}
								style={{
									width: 52,
									height: 52,
									border: `1px solid ${ttsActive ? 'rgba(0,212,255,0.4)' : 'var(--border)'}`,
									borderRadius: 4,
									background: ttsActive ? 'var(--glow2)' : 'var(--panel)',
									color: ttsActive ? 'var(--accent)' : 'var(--text-dim)',
									cursor: 'pointer',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
								}}
							>
								{ttsActive ? <Volume2 size={20} /> : <VolumeX size={20} />}
							</button>
							<button
								onClick={() => fileInputRef.current?.click()}
								disabled={!activeChatId || isTyping}
								style={{
									width: 52,
									height: 52,
									border: `1px solid ${imagePreview ? 'rgba(0,212,255,0.4)' : 'var(--border)'}`,
									borderRadius: 4,
									background: imagePreview ? 'var(--glow2)' : 'var(--panel)',
									color: imagePreview ? 'var(--accent)' : 'var(--text-dim)',
									cursor: 'pointer',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
								}}
							>
								<Image size={20} />
							</button>
							<textarea
								value={input}
								onChange={e => setInput(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Digite uma mensagem ou descreva o que deseja analisar na imagem..."
								disabled={!activeChatId}
								style={{
									flex: 1,
									background: 'var(--panel)',
									border: '1px solid var(--border)',
									borderRadius: 4,
									padding: '14px 16px',
									fontFamily: 'var(--sans)',
									fontSize: 15,
									color: 'var(--text)',
									outline: 'none',
									resize: 'none',
									minHeight: 52,
									maxHeight: 140,
								}}
							/>
							<button
								onClick={toggleMic}
								disabled={!activeChatId}
								style={{
									width: 52,
									height: 52,
									border: `1px solid ${isRecording ? 'var(--accent3)' : 'var(--border)'}`,
									borderRadius: 4,
									background: isRecording
										? 'rgba(255,60,110,0.08)'
										: 'var(--panel)',
									color: isRecording ? 'var(--accent3)' : 'var(--text-dim)',
									cursor: 'pointer',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
								}}
							>
								<Mic size={20} />
							</button>
							<button
								onClick={() => enviarMensagem()}
								disabled={(!input.trim() && !selectedImage) || isTyping || !activeChatId}
								style={{
									width: 52,
									height: 52,
									border: '1px solid rgba(0,212,255,0.3)',
									borderRadius: 4,
									background: 'linear-gradient(135deg, #003060, #001840)',
									color: 'var(--accent)',
									cursor: 'pointer',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
								}}
							>
								<Send size={20} />
							</button>
						</div>
					</footer>
				</div>
			</div>
		</>
	);
}
