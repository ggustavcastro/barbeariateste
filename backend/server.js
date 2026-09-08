const pool = require('./db');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 54321;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static('../frontend'));

// ==================================================
// 📦 DADOS
// ==================================================
const SERVICOS = [
  { id: 1, nome: 'Corte social', duracao_minutos: 30, valor: 25.00 },
  { id: 2, nome: 'Degrade social', duracao_minutos: 30, valor: 30.00 },
  { id: 3, nome: 'Degrade navalhado', duracao_minutos: 40, valor: 35.00 },
  { id: 4, nome: 'Sobrancelha', duracao_minutos: 10, valor: 10.00 },
  { id: 5, nome: 'Bigode', duracao_minutos: 5, valor: 5.00 },
  { id: 6, nome: 'Cavanhaque', duracao_minutos: 5, valor: 5.00 },
  { id: 7, nome: 'Barba', duracao_minutos: 30, valor: 25.00 }
];

let AGENDAMENTOS = [];

// 💈 BARBEIRO — Login direto sem hash
const USUARIO_BARBEIRO = {
  id: 1,
  email: 'barbeiro@barbearia.com',
  senha: '123456',
  nome: 'Barbeiro Eduardo',
  telefone: '(00) 00000-0000',
  is_barbeiro: true
};

let USUARIOS_NOVOS = [];
let SESSAO = { logado: false, usuario: null };

// ==================================================
// 🔗 ROTAS
// ==================================================

app.get('/api/servicos', (req, res) => res.json(SERVICOS));

app.post('/api/agendamentos', (req, res) => {
  const novo = { id: AGENDAMENTOS.length + 1, ...req.body, status: 'pendente' };
  AGENDAMENTOS.push(novo);
  res.status(201).json(novo);
});

app.get('/api/agendamentos', (req, res) => {
  if (!SESSAO.logado) return res.status(401).json({ erro: 'Faça login' });
  if (SESSAO.usuario?.is_barbeiro) {
    return res.json(AGENDAMENTOS);
  } else {
    const meus = AGENDAMENTOS.filter(a => a.telefone === SESSAO.usuario?.telefone);
    return res.json(meus);
  }
});

app.post('/api/cadastro', (req, res) => {
  const { email, senha, nome, telefone } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' });
  
  const existe = USUARIOS_NOVOS.find(u => u.email.toLowerCase() === email.toLowerCase()) ||
                 USUARIO_BARBEIRO.email.toLowerCase() === email.toLowerCase();
  if (existe) return res.status(400).json({ erro: 'Email já cadastrado' });

  const novo = {
    id: USUARIOS_NOVOS.length + 2,
    email: email.toLowerCase(),
    senha: senha,
    nome,
    telefone,
    is_barbeiro: false
  };
  USUARIOS_NOVOS.push(novo);
  res.status(201).json({ 
    id: novo.id, 
    email: novo.email, 
    nome: novo.nome,
    is_barbeiro: novo.is_barbeiro
  });
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  const emailLower = email.toLowerCase();

  // Verifica barbeiro
  if (USUARIO_BARBEIRO.email.toLowerCase() === emailLower && 
      USUARIO_BARBEIRO.senha === senha) {
    SESSAO.logado = true;
    SESSAO.usuario = { 
      id: USUARIO_BARBEIRO.id, 
      email: USUARIO_BARBEIRO.email, 
      nome: USUARIO_BARBEIRO.nome,
      telefone: USUARIO_BARBEIRO.telefone,
      is_barbeiro: true
    };
    return res.json({ ok: true, usuario: SESSAO.usuario });
  }

  // Verifica cliente
  const usuario = USUARIOS_NOVOS.find(u => u.email.toLowerCase() === emailLower);
  if (usuario && usuario.senha === senha) {
    SESSAO.logado = true;
    SESSAO.usuario = { 
      id: usuario.id, 
      email: usuario.email, 
      nome: usuario.nome,
      telefone: usuario.telefone,
      is_barbeiro: false
    };
    return res.json({ ok: true, usuario: SESSAO.usuario });
  }

  return res.status(401).json({ erro: 'Credenciais inválidas' });
});

app.get('/api/eu', (req, res) => res.json(SESSAO));

app.post('/api/logout', (req, res) => {
  SESSAO.logado = false;
  SESSAO.usuario = null;
  res.json({ ok: true });
});

app.post('/api/recuperar-senha', (req, res) => {
  res.json({ ok: true, mensagem: 'Função disponível em breve' });
});

app.post('/api/redefinir-senha', (req, res) => {
  res.json({ ok: true, mensagem: 'Função disponível em breve' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`💈 Barbeiro: barbeiro@barbearia.com / 123456`);
});
// TESTE DE CONEXÃO COM O BANCO
app.get("/api/teste-banco", async (req, res) => {
  try {
    const resultado = await pool.query("SELECT NOW() AS hora");
    res.json({
      conectado: true,
      mensagem: "✅ Banco conectado com sucesso!",
      hora_banco: resultado.rows[0].hora
    });
  } catch (erro) {
    res.json({
      conectado: false,
      erro: erro.message
    });
  }
});