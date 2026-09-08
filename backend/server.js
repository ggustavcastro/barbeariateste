// ✅ IMPORTAÇÃO CORRIGIDA com chaves {}
const { pool, inicializarBanco } = require('./db');

// ✅ CRIA AS TABELAS AUTOMATICAMENTE ao ligar o servidor
inicializarBanco();

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 54321;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static('../frontend'));

// ==================================================
// 🧪 TESTE DE CONEXÃO COM O BANCO
// ==================================================
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

// ==================================================
// 💈 ROTAS DE SERVIÇOS
// ==================================================
app.get('/api/servicos', async (req, res) => {
  try {
    const resultado = await pool.query("SELECT * FROM servicos ORDER BY id");
    res.json(resultado.rows);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// ==================================================
// ⏰ ROTA DE HORÁRIOS DISPONÍVEIS
// ==================================================
app.get('/api/horarios', async (req, res) => {
  const { data } = req.query;

  // Horários de funcionamento: 08:00 às 18:30, de 30 em 30 minutos
  const todosHorarios = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
    "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
    "17:00", "17:30", "18:00", "18:30"
  ];

  try {
    // Busca horários JÁ AGENDADOS nessa data
    const ocupados = await pool.query(
      "SELECT horario FROM agendamentos WHERE data_agendamento = $1",
      [data]
    );

    const listaOcupados = ocupados.rows.map(h => h.horario.slice(0, 5));

    // Filtra apenas os horários LIVRES
    const disponiveis = todosHorarios.filter(h => !listaOcupados.includes(h));

    res.json({
      todos: todosHorarios,
      ocupados: listaOcupados,
      disponiveis: disponiveis
    });

  } catch (erro) {
    console.error("❌ Erro ao buscar horários:", erro.message);
    // Se der erro, retorna TODOS os horários como disponíveis
    res.json({
      todos: todosHorarios,
      ocupados: [],
      disponiveis: todosHorarios
    });
  }
});

// ==================================================
// 📅 ROTAS DE AGENDAMENTOS (com VALIDAÇÃO DE HORÁRIO)
// ==================================================
app.post('/api/agendamentos', async (req, res) => {
  const { nome_cliente, telefone, servico_id, data, horario, barbeiro } = req.body;

  if (!nome_cliente || !telefone || !servico_id || !data || !horario) {
    return res.status(400).json({ erro: 'Preencha todos os campos!' });
  }

  try {
    // 🔍 VERIFICA SE O HORÁRIO JÁ ESTÁ OCUPADO
    const horarioOcupado = await pool.query(
      "SELECT * FROM agendamentos WHERE data_agendamento = $1 AND horario = $2",
      [data, horario]
    );

    if (horarioOcupado.rows.length > 0) {
      return res.status(409).json({
        sucesso: false,
        mensagem: "❌ Esse horário JÁ ESTÁ AGENDADO! Escolha outro horário."
      });
    }

    // ✅ SALVA NO BANCO
    const novoAgendamento = await pool.query(
      `INSERT INTO agendamentos (nome_cliente, telefone, servico_id, data_agendamento, horario, barbeiro)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nome_cliente, telefone, servico_id, data, horario, barbeiro || 'Barbeiro Eduardo']
    );

    res.status(201).json({
      sucesso: true,
      mensagem: "✅ Agendamento CONFIRMADO com sucesso!",
      agendamento: novoAgendamento.rows[0]
    });

  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

app.get('/api/agendamentos', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT a.*, s.nome as nome_servico, s.valor 
      FROM agendamentos a 
      LEFT JOIN servicos s ON a.servico_id = s.id 
      ORDER BY data_agendamento DESC, horario
    `);
    res.json(resultado.rows);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// ==================================================
// 🔐 SISTEMA DE LOGIN E CADASTRO
// ==================================================
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
  res.status(201).json({ id: novo.id, email: novo.email, nome: novo.nome, is_barbeiro: novo.is_barbeiro });
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  const emailLower = email.toLowerCase();

  // Login do barbeiro
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

  // Login do cliente
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

// ==================================================
// 🚀 INICIAR SERVIDOR
// ==================================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`💈 Barbeiro: barbeiro@barbearia.com / 123456`);
});