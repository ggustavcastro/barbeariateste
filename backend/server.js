const { pool, inicializarBanco } = require('./db');
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
// 🧪 TESTE DE CONEXÃO
// ==================================================
app.get("/api/teste-banco", async (req, res) => {
  try {
    const resultado = await pool.query("SELECT NOW() AS hora");
    res.json({ conectado: true, mensagem: "✅ Banco conectado!", hora_banco: resultado.rows[0].hora });
  } catch (erro) {
    res.json({ conectado: false, erro: erro.message });
  }
});

// ==================================================
// 💈 SERVIÇOS
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
// ⏰ HORÁRIOS
// ==================================================
app.get('/api/horarios', async (req, res) => {
  const { data } = req.query;
  const todosHorarios = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
    "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
    "17:00", "17:30", "18:00", "18:30"
  ];
  try {
    const ocupados = await pool.query(
      "SELECT horario FROM agendamentos WHERE data_agendamento = $1", [data]
    );
    const listaOcupados = ocupados.rows.map(h => h.horario.slice(0, 5));
    const disponiveis = todosHorarios.filter(h => !listaOcupados.includes(h));
    res.json({ todos: todosHorarios, ocupados: listaOcupados, disponiveis });
  } catch (erro) {
    res.json({ todos: todosHorarios, ocupados: [], disponiveis: todosHorarios });
  }
});

// ==================================================
// 📅 SALVAR AGENDAMENTO — ✅ CORRIGIDO!
// ==================================================
app.post('/api/agendamentos', async (req, res) => {
  const { nome_cliente, telefone, lista_servicos, data_agendamento, horario_inicio, barbeiro } = req.body;

  if (!nome_cliente || !lista_servicos || !data_agendamento || !horario_inicio) {
    return res.status(400).json({ erro: 'Preencha data, horário e pelo menos um serviço!' });
  }

  try {
    // Verifica se horário está ocupado
    const ocupado = await pool.query(
      "SELECT * FROM agendamentos WHERE data_agendamento = $1 AND horario = $2",
      [data_agendamento, horario_inicio]
    );
    if (ocupado.rows.length > 0) {
      return res.status(409).json({ sucesso: false, mensagem: "❌ Esse horário JÁ ESTÁ AGENDADO!" });
    }

    // Pega o primeiro serviço da lista
    const primeiroServico = lista_servicos[0];
    const servico_id = primeiroServico?.id || 1;

    // Salva no banco
    const novo = await pool.query(
      `INSERT INTO agendamentos (nome_cliente, telefone, servico_id, data_agendamento, horario, barbeiro)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        nome_cliente,
        telefone || 'Não informado',
        servico_id,
        data_agendamento,
        horario_inicio,
        barbeiro || 'Barbeiro Eduardo'
      ]
    );

    res.status(201).json({ sucesso: true, mensagem: "✅ Agendamento CONFIRMADO!", agendamento: novo.rows[0] });
  } catch (erro) {
    console.error('❌ Erro ao salvar:', erro);
    res.status(500).json({ erro: erro.message });
  }
});

// ==================================================
// 📋 LISTAR AGENDAMENTOS
// ==================================================
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
// 🔐 CADASTRO NO BANCO
// ==================================================
app.post('/api/cadastro', async (req, res) => {
  const { email, senha, nome, telefone } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' });
  try {
    const existe = await pool.query("SELECT id FROM usuarios WHERE email = $1", [email.toLowerCase()]);
    if (existe.rows.length > 0) {
      return res.status(400).json({ erro: 'Email já cadastrado' });
    }
    const novo = await pool.query(
      `INSERT INTO usuarios (email, senha_hash, nome) VALUES ($1, $2, $3) RETURNING id, email, nome`,
      [email.toLowerCase(), senha, nome]
    );
    res.status(201).json({ id: novo.rows[0].id, email: novo.rows[0].email, nome: novo.rows[0].nome, is_barbeiro: false });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// ==================================================
// 🔐 LOGIN — ✅ Corrigido para carregar telefone
// ==================================================
const USUARIO_BARBEIRO = {
  id: 1,
  email: 'barbeiro@barbearia.com',
  senha: '123456',
  nome: 'Barbeiro Eduardo',
  telefone: '(00) 00000-0000',
  is_barbeiro: true
};
let SESSAO = { logado: false, usuario: null };

app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body;
  const emailLower = email.toLowerCase();

  // Login do Barbeiro
  if (USUARIO_BARBEIRO.email.toLowerCase() === emailLower && USUARIO_BARBEIRO.senha === senha) {
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

  // Login do Cliente
  try {
    const resultado = await pool.query("SELECT id, email, nome, senha_hash FROM usuarios WHERE email = $1", [emailLower]);
    if (resultado.rows.length > 0 && resultado.rows[0].senha_hash === senha) {
      const u = resultado.rows[0];
      SESSAO.logado = true;
      SESSAO.usuario = { 
        id: u.id, 
        email: u.email, 
        nome: u.nome, 
        telefone: '', 
        is_barbeiro: false 
      };
      return res.json({ ok: true, usuario: SESSAO.usuario });
    }
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  } catch (erro) {
    return res.status(500).json({ erro: erro.message });
  }
});

// ==================================================
// 📊 VER USUÁRIOS
// ==================================================
app.get('/api/usuarios', async (req, res) => {
  try {
    const resultado = await pool.query("SELECT id, email, nome, criado_em FROM usuarios ORDER BY id");
    res.json(resultado.rows);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

app.get('/api/eu', (req, res) => res.json(SESSAO));
app.post('/api/logout', (req, res) => {
  SESSAO.logado = false;
  SESSAO.usuario = null;
  res.json({ ok: true });
});
app.post('/api/recuperar-senha', (req, res) => res.json({ ok: true, mensagem: 'Função disponível em breve' }));
app.post('/api/redefinir-senha', (req, res) => res.json({ ok: true, mensagem: 'Função disponível em breve' }));

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`💈 Barbeiro: barbeiro@barbearia.com / 123456`);
});