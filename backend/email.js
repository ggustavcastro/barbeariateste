const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USUARIO,
    pass: process.env.EMAIL_SENHA
  }
});

async function enviarEmailRecuperacao(destinatario, linkToken) {
  const assunto = 'Recuperação de Senha — Barbearia Corte & Estilo';
  const html = `
    <h2>Recuperação de Senha</h2>
    <p>Você solicitou a recuperação de senha. Clique no link abaixo para redefinir:</p>
    <a href="${linkToken}" style="padding:10px 20px; background:#00b4d8; color:white; border-radius:6px; text-decoration:none;">Redefinir Senha</a>
    <p>Se não foi você, ignore este email.</p>
    <p>O link expira em 1 hora.</p>
  `;
  await transporter.sendMail({
    from: `"Barbearia Corte & Estilo" <${process.env.EMAIL_USUARIO}>`,
    to: destinatario,
    subject: assunto,
    html
  });
}

module.exports = { enviarEmailRecuperacao };