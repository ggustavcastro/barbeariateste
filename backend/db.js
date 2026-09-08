const { Pool } = require('pg');
require('dotenv').config();
const isProduction = !!process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

const inicializarBanco = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS servicos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL UNIQUE,
        duracao_minutos INTEGER NOT NULL,
        valor DECIMAL(10,2) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agendamentos (
        id SERIAL PRIMARY KEY,
        nome_cliente VARCHAR(100) NOT NULL,
        telefone VARCHAR(20) NOT NULL,
        servico_id INTEGER REFERENCES servicos(id),
        data_agendamento DATE NOT NULL,
        horario TIME NOT NULL,
        barbeiro VARCHAR(100) NOT NULL,
        status VARCHAR(20) DEFAULT 'pendente'
      );
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha_hash VARCHAR(255) NOT NULL,
        nome VARCHAR(100),
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO servicos (nome, duracao_minutos, valor)
      VALUES
        ('Corte social', 30, 25.00),
        ('Degrade social', 30, 30.00),
        ('Degrade navalhado', 40, 35.00),
        ('Sobrancelha', 10, 10.00),
        ('Bigode', 5, 5.00),
        ('Cavanhaque', 5, 5.00),
        ('Barba', 30, 25.00)
      ON CONFLICT (nome) DO NOTHING;
    `);
    console.log('✅ Banco inicializado!');
  } catch (err) {
    console.error('❌ Erro banco:', err);
  } finally {
    client.release();
  }
};

module.exports = { pool, inicializarBanco };