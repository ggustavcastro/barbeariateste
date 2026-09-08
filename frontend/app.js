const API_URL = window.location.origin;
let listaServicos = [];

// ==================================================
// 💈 CARREGAR SERVIÇOS NO DROPDOWN
// ==================================================
async function carregarServicosSelect() {
  try {
    const res = await fetch(`${API_URL}/api/servicos`);
    if (!res.ok) throw new Error('Erro ao buscar serviços');
    listaServicos = await res.json();
    console.log('✅ Serviços carregados:', listaServicos.length);

    // Espera o elemento existir na página
    const tentarCarregar = () => {
      const select = document.getElementById('servico');
      if (select) {
        select.innerHTML = '<option value="">Selecione um serviço...</option>' +
          listaServicos.map(s =>
            `<option value="${s.id}" data-nome="${s.nome}" data-duracao="${s.duracao_minutos}" data-valor="${s.valor}">${s.nome} — R$ ${Number(s.valor).toFixed(2)} (${s.duracao_minutos} min)</option>`
          ).join('');
        console.log('✅ Serviços exibidos no dropdown');
        
        // Atualiza horários quando escolher serviço
        select.addEventListener('change', () => {
          const opcao = select.selectedOptions[0];
          if (opcao && opcao.value) {
            carregarHorarios();
          }
        });
      } else {
        setTimeout(tentarCarregar, 100);
      }
    };
    tentarCarregar();

  } catch (erro) {
    console.error('❌ Falha ao carregar serviços:', erro);
  }
}

// ==================================================
// ⏰ CARREGAR HORÁRIOS
// ==================================================
async function carregarHorarios() {
  const dataInput = document.getElementById('data');
  const data = dataInput?.value;
  if (!data) return;

  try {
    const res = await fetch(`${API_URL}/api/horarios?data=${encodeURIComponent(data)}`);
    const dados = await res.json();
    
    const selectHorario = document.getElementById('horario');
    if (selectHorario) {
      selectHorario.innerHTML = '<option value="">Selecione um horário...</option>' +
        dados.disponiveis.map(h => `<option value="${h}">${h} ✅ Disponível</option>`).join('') +
        dados.ocupados.map(h => `<option value="${h}" disabled>${h} ❌ Ocupado</option>`).join('');
    }
  } catch (erro) {
    console.error('❌ Erro ao carregar horários:', erro);
  }
}

// ==================================================
// 📅 ENVIAR AGENDAMENTO
// ==================================================
async function enviarAgendamento(e) {
  e.preventDefault();
  
  const servicoSelect = document.getElementById('servico');
  const servicoId = servicoSelect.value;
  const servicoNome = servicoSelect.selectedOptions[0]?.dataset.nome;
  const servicoValor = servicoSelect.selectedOptions[0]?.dataset.valor;

  const dados = {
    nome_cliente: document.getElementById('nome').value,
    telefone: document.getElementById('telefone').value,
    lista_servicos: [{ id: servicoId, nome: servicoNome, valor: servicoValor }],
    data_agendamento: document.getElementById('data').value,
    horario_inicio: document.getElementById('horario').value,
    barbeiro: 'Barbeiro Eduardo'
  };

  if (!dados.nome_cliente || !dados.data_agendamento || !dados.horario_inicio || !servicoId) {
    return alert('Preencha todos os campos!');
  }

  try {
    const res = await fetch(`${API_URL}/api/agendamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    const resposta = await res.json();
    
    if (res.ok && resposta.sucesso) {
      alert(resposta.mensagem);
      e.target.reset();
    } else {
      alert(resposta.mensagem || resposta.erro || 'Erro ao agendar');
    }
  } catch (erro) {
    alert('Erro de conexão: ' + erro.message);
  }
}

// ==================================================
// ✅ INICIALIZA TUDO QUANDO PÁGINA CARREGAR
// ==================================================
document.addEventListener('DOMContentLoaded', () => {
  carregarServicosSelect();

  // Atualiza horários quando mudar a data
  document.getElementById('data')?.addEventListener('change', carregarHorarios);

  // Envia formulário
  document.getElementById('form-agendamento')?.addEventListener('submit', enviarAgendamento);
});