const API_URL = window.location.origin;

// === SEM IMAGEM DE FUNDO DA PÁGINA ===
(function definirImagemFundo() {
  const estilo = document.createElement('style');
  estilo.textContent = `
    html, body {
      margin: 0;
      padding: 0;
      background-color: #000;
    }
  `;
  document.head.appendChild(estilo);
})();

const paginas = {
  '/': 'paginas/inicio.html',
  '/agendar': 'paginas/agendar.html',
  '/login': 'paginas/login.html',
  '/cadastro': 'paginas/cadastro.html',
  '/recuperar-senha': 'paginas/recuperar-senha.html',
  '/redefinir-senha': 'paginas/redefinir-senha.html',
  '/admin': 'paginas/admin.html',
  '/meus-agendamentos': 'paginas/meus-agendamentos.html'
};
let estadoUsuario = { logado: false, usuario: null };
let listaServicos = [];
let servicosSelecionados = [];
let todosAgendamentos = [];
const HORARIOS = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
                  '13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'];
window.addEventListener('hashchange', rotear);
window.addEventListener('load', rotear);
async function rotear() {
  let caminho = window.location.hash.slice(1) || '/';
  const [pagina, parametros] = caminho.split('?');
  const arquivo = paginas[pagina];
  if (!arquivo) { window.location.hash = '/'; return; }
  if (pagina === '/agendar' && !estadoUsuario.logado) {
    localStorage.setItem('mensagem_aviso', '⚠️ Faça login para agendar um horário');
    window.location.hash = '/login';
    return;
  }
  await carregarPagina(arquivo);
  await verificarSessao();
  atualizarMenu();
  const mensagemSucesso = localStorage.getItem('mensagem_sucesso');
  if (pagina === '/' && mensagemSucesso) {
    setTimeout(() => mostrarMensagemTelaInicial(mensagemSucesso, 'sucesso'), 150);
    localStorage.removeItem('mensagem_sucesso');
  }
  const mensagemAviso = localStorage.getItem('mensagem_aviso');
  if (pagina === '/login' && mensagemAviso) {
    setTimeout(() => mostrarMensagem(mensagemAviso, 'aviso'), 150);
    localStorage.removeItem('mensagem_aviso');
  }
  if (pagina === '/agendar') {
    servicosSelecionados = [];
    await carregarServicosSelect();
    await carregarTodosAgendamentos();
    configurarCamposAgendamento();
    vincularBotoesAgendar();
  }
  if (pagina === '/admin') carregarAgendamentosAdmin();
  if (pagina === '/meus-agendamentos') carregarMeusAgendamentos();
  if (pagina === '/redefinir-senha') tratarTokenRedefinir(parametros);
}
async function carregarPagina(arquivo) {
  const conteudo = document.getElementById('conteudo-pagina');
  conteudo.classList.remove('pronto');
  try {
    const res = await fetch(arquivo);
    if (!res.ok) throw new Error(`Arquivo não encontrado: ${arquivo}`);
    conteudo.innerHTML = await res.text();
    vincularFormularios();
    setTimeout(() => conteudo.classList.add('pronto'), 30);
  } catch (erro) {
    conteudo.innerHTML = `<div style="padding:3rem;text-align:center;"><h2 style="color:#ef4444;">Erro</h2><p>${erro.message}</p></div>`;
    setTimeout(() => conteudo.classList.add('pronto'), 30);
  }
}
function navegar(caminho) {
  window.location.hash = caminho;
}
async function verificarSessao() {
  try {
    const res = await fetch(`${API_URL}/api/eu`);
    estadoUsuario = await res.json();
  } catch {
    estadoUsuario = { logado: false };
  }
}
function atualizarMenu() {
  const menu = document.getElementById('menu-navegacao');
  if (estadoUsuario.logado) {
    const ehBarbeiro = estadoUsuario.usuario?.is_barbeiro;
    if (ehBarbeiro) {
      menu.innerHTML = `
        <a href="#/" onclick="navegar('/')">Início</a>
        <a href="#/agendar">Agendar</a>
        <a href="#/admin" class="btn-destaque">💈 Agendamentos do Dia</a>
        <button onclick="sair()">Sair</button>
      `;
    } else {
      menu.innerHTML = `
        <a href="#/" onclick="navegar('/')">Início</a>
        <a href="#/agendar">Agendar</a>
        <a href="#/meus-agendamentos" class="btn-destaque">Meus Agendamentos</a>
        <button onclick="sair()">Sair</button>
      `;
    }
  } else {
    menu.innerHTML = `
      <a href="#/" onclick="navegar('/')">Início</a>
      <a href="#/agendar">Agendar</a>
      <a href="#/login" class="btn-destaque">Entrar</a>
    `;
  }
}
function vincularFormularios() {
  const login = document.getElementById('form-login');
  if (login) login.addEventListener('submit', fazerLogin);
  const cadastro = document.getElementById('form-cadastro');
  if (cadastro) cadastro.addEventListener('submit', fazerCadastro);
  const agendar = document.getElementById('form-agendar');
  if (agendar) agendar.addEventListener('submit', criarAgendamento);
  const recuperar = document.getElementById('form-recuperar-senha');
  if (recuperar) recuperar.addEventListener('submit', solicitarRecuperacao);
  const redefinir = document.getElementById('form-redefinir-senha');
  if (redefinir) redefinir.addEventListener('submit', redefinirSenha);
  const telefone = document.getElementById('telefone');
  if (telefone) telefone.addEventListener('input', formatarTelefone);
}
function formatarTelefone(e) {
  let valor = e.target.value.replace(/\D/g, '');
  if (valor.length > 11) valor = valor.slice(0, 11);
  if (valor.length > 6) {
    valor = `(${valor.slice(0,2)}) ${valor.slice(2,7)}-${valor.slice(7,11)}`;
  } else if (valor.length > 2) {
    valor = `(${valor.slice(0,2)}) ${valor.slice(2)}`;
  } else if (valor.length > 0) {
    valor = `(${valor}`;
  }
  e.target.value = valor;
}
async function carregarServicosSelect() {
  const res = await fetch(`${API_URL}/api/servicos`);
  listaServicos = await res.json();
  const select = document.getElementById('servico');
  if (select) {
    select.innerHTML = '<option value="">Selecione um serviço...</option>' +
      listaServicos.map(s => `<option value="${s.id}" data-nome="${s.nome}" data-duracao="${s.duracao_minutos}" data-valor="${s.valor}">${s.nome} — R$ ${s.valor.toFixed(2)} (${s.duracao_minutos}min)</option>`).join('');
  }
}
async function carregarTodosAgendamentos() {
  try {
    const res = await fetch(`${API_URL}/api/agendamentos`);
    if (res.ok) {
      todosAgendamentos = await res.json();
    }
  } catch {
    todosAgendamentos = [];
  }
}
function vincularBotoesAgendar() {
  document.getElementById('btn-adicionar').addEventListener('click', adicionarProcedimento);
  document.getElementById('horario').addEventListener('change', atualizarHorarioTermino);
  document.getElementById('data_agendamento').addEventListener('change', atualizarHorariosDisponiveis);
}
function adicionarProcedimento() {
  const select = document.getElementById('servico');
  const opcaoSelecionada = select.options[select.selectedIndex];
  if (!opcaoSelecionada.value) {
    mostrarMensagem('❌ Selecione um serviço primeiro!', 'erro');
    return;
  }
  const idServico = opcaoSelecionada.value;
  const nomeServico = opcaoSelecionada.dataset.nome;
  const duracaoServico = parseInt(opcaoSelecionada.dataset.duracao);
  const valorServico = parseFloat(opcaoSelecionada.dataset.valor);
  if (servicosSelecionados.some(s => s.id === idServico)) {
    mostrarMensagem(`⚠️ "${nomeServico}" já foi adicionado! Remova antes de adicionar de novo.`, 'aviso');
    select.selectedIndex = 0;
    return;
  }
  servicosSelecionados.push({ id: idServico, nome: nomeServico, duracao: duracaoServico, valor: valorServico });
  atualizarListaProcedimentos();
  atualizarInformacoesTempo();
  select.selectedIndex = 0;
}
function removerProcedimento(indice) {
  servicosSelecionados.splice(indice, 1);
  atualizarListaProcedimentos();
  atualizarInformacoesTempo();
}
function atualizarListaProcedimentos() {
  const container = document.getElementById('procedimentos-adicionados');
  if (servicosSelecionados.length === 0) { container.innerHTML = ''; return; }
  container.innerHTML = servicosSelecionados.map((s, i) => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0.8rem; background:#1f2937; border-radius:6px; margin:0.4rem 0;">
      <span>${s.nome} — ${s.duracao} min</span>
      <button type="button" onclick="removerProcedimento(${i})" style="background:none; border:none; color:#f87171; cursor:pointer; font-weight:bold;">✕</button>
    </div>
  `).join('');
}
function calcularDuracaoTotal() {
  return servicosSelecionados.reduce((total, s) => total + s.duracao, 0);
}
function calcularHorarioTermino(horaInicio, duracaoMinutos) {
  if (!horaInicio || !duracaoMinutos) return '--:--';
  const [h, m] = horaInicio.split(':').map(Number);
  const totalMinutos = h * 60 + m + duracaoMinutos;
  const fimH = Math.floor(totalMinutos / 60);
  const fimM = totalMinutos % 60;
  return `${fimH.toString().padStart(2,'0')}:${fimM.toString().padStart(2,'0')}`;
}
function atualizarInformacoesTempo() {
  const duracaoTotal = calcularDuracaoTotal();
  document.getElementById('duracao-total').textContent = `${duracaoTotal} min`;
  atualizarHorariosDisponiveis(duracaoTotal);
  atualizarHorarioTermino();
}
function atualizarHorariosDisponiveis(duracaoTotal = null) {
  const dataSelecionada = document.getElementById('data_agendamento').value;
  const select = document.getElementById('horario');
  if (!dataSelecionada || !duracaoTotal) {
    select.innerHTML = '<option value="">Selecione um serviço primeiro...</option>';
    return;
  }
  const horariosOcupados = todosAgendamentos
    .filter(a => {
      const dataAgendamento = String(a.data_agendamento).split('T')[0];
      return dataAgendamento === dataSelecionada;
    })
    .map(a => ({
      inicio: a.horario_inicio || a.horario,
      fim: a.horario_termino || null
    }));
  select.innerHTML = '<option value="">Selecione um horário...</option>';
  const blocosNecessarios = Math.ceil(duracaoTotal / 30);
  const ultimoIndicePermitido = HORARIOS.length - blocosNecessarios;
  function horarioConflita(horaInicio, duracaoMinutos) {
    const [hIni, mIni] = horaInicio.split(':').map(Number);
    const inicioMin = hIni * 60 + mIni;
    const fimMin = inicioMin + duracaoMinutos;
    for (const ocupado of horariosOcupados) {
      if (!ocupado.inicio || !ocupado.fim) continue;
      const [oHIni, oMIni] = ocupado.inicio.split(':').map(Number);
      const oInicioMin = oHIni * 60 + oMIni;
      const [oHFim, oMFim] = ocupado.fim.split(':').map(Number);
      const oFimMin = oHFim * 60 + oMFim;
      if (!(fimMin <= oInicioMin || inicioMin >= oFimMin)) return true;
    }
    return false;
  }
  HORARIOS.forEach((hora, indice) => {
    if (indice <= ultimoIndicePermitido && !horarioConflita(hora, duracaoTotal)) {
      const opcao = document.createElement('option');
      opcao.value = hora;
      opcao.textContent = hora;
      select.appendChild(opcao);
    }
  });
}
function atualizarHorarioTermino() {
  const horaInicio = document.getElementById('horario').value;
  const duracaoTotal = calcularDuracaoTotal();
  document.getElementById('horario-termino').textContent = calcularHorarioTermino(horaInicio, duracaoTotal);
}
function configurarCamposAgendamento() {
  const dataInput = document.getElementById('data_agendamento');
  const horaSelect = document.getElementById('horario');
  const nomeUsuario = document.getElementById('nome-usuario');
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  const dataHojeTexto = `${ano}-${mes}-${dia}`;
  dataInput.min = dataHojeTexto;
  dataInput.value = dataHojeTexto;
  horaSelect.innerHTML = '<option value="">Selecione um serviço primeiro...</option>';
  if (nomeUsuario && estadoUsuario.usuario) {
    nomeUsuario.textContent = estadoUsuario.usuario.nome;
  }
}
async function fazerCadastro(e) {
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(e.target));
  const res = await fetch(`${API_URL}/api/cadastro`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados)
  });
  if (res.ok) {
    mostrarMensagem('✅ Conta criada! Faça login.', 'sucesso');
    setTimeout(() => navegar('/login'), 1500);
  } else {
    const r = await res.json();
    mostrarMensagem(r.erro || 'Erro', 'erro');
  }
}
async function fazerLogin(e) {
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(e.target));
  const res = await fetch(`${API_URL}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados)
  });
  const resposta = await res.json();
  if (res.ok) {
    localStorage.setItem('mensagem_sucesso', `✅ Bem-vindo, ${resposta.usuario.nome}!`);
    await verificarSessao();
    if (resposta.usuario.is_barbeiro) { navegar('/admin'); }
    else { navegar('/agendar'); }
  } else {
    mostrarMensagem(resposta.erro || 'Erro', 'erro');
  }
}
async function sair() {
  await fetch(`${API_URL}/api/logout`, { method: 'POST' });
  estadoUsuario = { logado: false };
  navegar('/');
}
async function criarAgendamento(e) {
  e.preventDefault();
  const dataEl = document.getElementById('data_agendamento');
  const horaEl = document.getElementById('horario');
  const duracaoTotal = calcularDuracaoTotal();
  if (servicosSelecionados.length === 0) {
    mostrarMensagem('❌ Adicione pelo menos um procedimento!', 'erro');
    return;
  }
  if (!dataEl.value || !horaEl.value) {
    mostrarMensagem('❌ Preencha data e horário!', 'erro');
    return;
  }
  const nomesServicos = servicosSelecionados.map(s => s.nome).join(' + ');
  const dados = {
    servicos: nomesServicos,
    lista_servicos: servicosSelecionados,
    data_agendamento: dataEl.value,
    horario_inicio: horaEl.value,
    horario_termino: calcularHorarioTermino(horaEl.value, duracaoTotal),
    duracao_total: duracaoTotal,
    nome_cliente: estadoUsuario.usuario.nome,
    telefone: estadoUsuario.usuario.telefone,
    barbeiro: 'Barbeiro Eduardo'
  };
  try {
    const res = await fetch(`${API_URL}/api/agendamentos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    if (res.ok) {
      localStorage.setItem('mensagem_sucesso', `✅ Agendamento CONFIRMADO! (${nomesServicos})`);
      navegar('/');
    } else {
      mostrarMensagem('❌ Erro ao salvar. Tente novamente.', 'erro');
    }
  } catch (erro) {
    mostrarMensagem('❌ Erro de conexão. Verifique se o servidor está rodando.', 'erro');
  }
}
async function carregarAgendamentosAdmin() {
  if (!estadoUsuario.logado || !estadoUsuario.usuario?.is_barbeiro) { navegar('/'); return; }
  const res = await fetch(`${API_URL}/api/agendamentos`);
  if (!res.ok) return;
  const agendamentos = await res.json();
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  const dataHojeTexto = `${ano}-${mes}-${dia}`;
  const agendamentosHoje = agendamentos.filter(a => {
    const dataAgendamento = String(a.data_agendamento).split('T')[0];
    return dataAgendamento === dataHojeTexto;
  });
  const lista = document.getElementById('lista-agendamentos');
  if (lista) {
    if (agendamentosHoje.length === 0) {
      lista.innerHTML = `<p style="text-align:center; color:#94a3b8; padding:2rem;">📭 Nenhum agendamento para hoje</p>`;
    } else {
      lista.innerHTML = `
        <table style="width:100%; border-collapse:collapse; margin-top:1rem;">
          <tr style="border-bottom:2px solid #374151;">
            <th style="padding:0.75rem; text-align:left; color:#67e8f9;">Horário</th>
            <th style="padding:0.75rem; text-align:left; color:#67e8f9;">Cliente</th>
            <th style="padding:0.75rem; text-align:left; color:#67e8f9;">Procedimentos</th>
            <th style="padding:0.75rem; text-align:left; color:#67e8f9;">Término</th>
          </tr>` +
          agendamentosHoje.map(a => {
            const horarioInicio = a.horario_inicio || a.horario || '--:--';
            const horarioFim = a.horario_termino || '--:--';
            const servicos = a.servicos || '-';
            const cliente = a.nome_cliente || 'Cliente';
            return `
            <tr style="border-bottom:1px solid #1f2937;">
              <td style="padding:0.75rem; font-weight:bold; color:#ffb703;">${horarioInicio}</td>
              <td style="padding:0.75rem;">${cliente}</td>
              <td style="padding:0.75rem;">${servicos}</td>
              <td style="padding:0.75rem;">${horarioFim}</td>
            </tr>`;
          }).join('') + `</table>`;
    }
  }
}
async function carregarMeusAgendamentos() {
  if (!estadoUsuario.logado) { navegar('/login'); return; }
  const res = await fetch(`${API_URL}/api/agendamentos`);
  if (!res.ok) return;
  const todos = await res.json();
  const meusAgendamentos = todos.filter(a => a.telefone === estadoUsuario.usuario.telefone);
  const lista = document.getElementById('meus-agendamentos-lista');
  if (lista) {
    if (meusAgendamentos.length === 0) {
      lista.innerHTML = `<p style="text-align:center; color:#94a3b8; padding:2rem;">📭 Você ainda não tem agendamentos</p>`;
    } else {
      lista.innerHTML = `
        <table style="width:100%; border-collapse:collapse; margin-top:1rem;">
          <tr style="border-bottom:2px solid #374151;">
            <th style="padding:0.75rem; text-align:left; color:#67e8f9;">Data</th>
            <th style="padding:0.75rem; text-align:left; color:#67e8f9;">Início</th>
            <th style="padding:0.75rem; text-align:left; color:#67e8f9;">Término</th>
            <th style="padding:0.75rem; text-align:left; color:#67e8f9;">Procedimentos</th>
          </tr>` +
          meusAgendamentos.map(a => {
            const horarioInicio = a.horario_inicio || a.horario || '--:--';
            const horarioFim = a.horario_termino || '--:--';
            const servicos = a.servicos || '-';
            return `
            <tr style="border-bottom:1px solid #1f2937;">
              <td style="padding:0.75rem;">${a.data_agendamento}</td>
              <td style="padding:0.75rem; font-weight:bold; color:#ffb703;">${horarioInicio}</td>
              <td style="padding:0.75rem;">${horarioFim}</td>
              <td style="padding:0.75rem;">${servicos}</td>
            </tr>`;
          }).join('') + `</table>`;
    }
  }
}
async function solicitarRecuperacao(e) {
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(e.target));
  const res = await fetch(`${API_URL}/api/recuperar-senha`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados)
  });
  const resposta = await res.json();
  mostrarMensagem(resposta.mensagem, 'sucesso');
}
let tokenRedefinir = null;
function tratarTokenRedefinir(parametros) {
  if (!parametros) return;
  const params = new URLSearchParams(parametros);
  tokenRedefinir = params.get('token');
}
async function redefinirSenha(e) {
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(e.target));
  if (!tokenRedefinir) return mostrarMensagem('Token inválido', 'erro');
  if (dados.senha !== dados.confirmar_senha) return mostrarMensagem('Senhas não coincidem', 'erro');
  const res = await fetch(`${API_URL}/api/redefinir-senha`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: tokenRedefinir, senha: dados.senha })
  });
  if (res.ok) {
    localStorage.setItem('mensagem_sucesso', '✅ Senha redefinida! Faça login.');
    setTimeout(() => navegar('/login'), 2000);
  } else {
    const r = await res.json();
    mostrarMensagem(r.erro || 'Erro', 'erro');
  }
}
function mostrarMensagem(texto, tipo) {
  const caixa = document.querySelector('.caixa-formulario');
  if (!caixa) return;
  const msgAnterior = document.querySelector('.mensagem');
  if (msgAnterior) msgAnterior.remove();
  const msg = document.createElement('div');
  msg.className = `mensagem ${tipo}`;
  msg.textContent = texto;
  msg.style.cssText = `margin: 1rem 0; padding: 0.8rem; border-radius: 6px; text-align:center; font-weight:bold;`;
  if (tipo === 'sucesso') { msg.style.background='rgba(16,185,129,0.2)'; msg.style.color='#34d399'; msg.style.border='1px solid #34d399'; }
  else if (tipo === 'aviso') { msg.style.background='rgba(255,183,3,0.2)'; msg.style.color='#ffd166'; msg.style.border='1px solid #ffd166'; }
  else { msg.style.background='rgba(239,68,68,0.2)'; msg.style.color='#f87171'; msg.style.border='1px solid #f87171'; }
  caixa.insertBefore(msg, caixa.firstChild);
}
function mostrarMensagemTelaInicial(texto, tipo) {
  const heroConteudo = document.querySelector('.hero-conteudo');
  if (!heroConteudo) return;
  const msgAnterior = document.querySelector('.mensagem-inicio');
  if (msgAnterior) msgAnterior.remove();
  const msg = document.createElement('div');
  msg.className = 'mensagem-inicio';
  msg.style.cssText = `
    margin-top: 2rem;
    padding: 1.2rem;
    border-radius: 8px;
    font-size: 1.1rem;
    font-weight: bold;
    text-align: center;
  `;
  if (tipo === 'sucesso') {
    msg.style.background = 'rgba(16,185,129,0.2)';
    msg.style.color = '#34d399';
    msg.style.border = '1px solid #34d399';
  } else if (tipo === 'aviso') {
    msg.style.background = 'rgba(255,183,3,0.2)';
    msg.style.color = '#ffd166';
    msg.style.border = '1px solid #ffd166';
  } else {
    msg.style.background = 'rgba(239,68,68,0.2)';
    msg.style.color = '#f87171';
    msg.style.border = '1px solid #f87171';
  }
  msg.textContent = texto;
  heroConteudo.appendChild(msg);
}