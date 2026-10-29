/* Public status summaries contain no invitation tokens or message bodies. */
(function () {
  'use strict';
  const labels = { sent: 'Aceito pelo provedor', pending: 'Na fila automática', processing: 'Em envio', failed: 'Falha — reenvie o acesso', cancelled: 'Cancelado' };
  window.CMEEmailNotice = function (result) {
    if (result?.enviado) return '\nO provedor aceitou o e-mail. A entrega na caixa de entrada depende do destinatário.';
    if (result?.agendado) return '\nAviso na fila automática do servidor; o envio será tentado novamente em caso de falha.';
    return '\n' + (result?.motivo || 'Não foi possível confirmar o aviso por e-mail. Consulte o histórico em Clientes.');
  };
  async function load() {
    const host = document.getElementById('emailDeliveryHistory');
    if (!host) return;
    const { data, error } = await window.supabaseClient.rpc('admin_client_email_status');
    if (error) { host.textContent = 'Não foi possível consultar os envios. Atualize o histórico para tentar novamente.'; return; }
    host.replaceChildren();
    const note = document.createElement('p');
    note.textContent = '“Aceito pelo provedor” confirma o envio. A chave atual não permite consultar entrega, rejeição ou spam no destinatário.';
    host.append(note);
    if (!data?.length) { host.append('Nenhum envio registrado.'); return; }
    for (const row of data.slice(0, 30)) {
      const entry = document.createElement('p');
      entry.textContent = `${new Date(row.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · ${row.kind === 'invite' ? 'Acesso' : 'Atualização'} · ${labels[row.status] || row.status} · ${row.attempts} tentativa(s)${row.last_error ? ' · ' + row.last_error : ''}`;
      host.append(entry);
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('listaClientes')) return;
    const card = document.createElement('section'); card.className = 'card-grande';
    const title = document.createElement('h2'); title.textContent = 'Histórico de e-mails';
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Atualizar histórico'; button.addEventListener('click', () => void load());
    const history = document.createElement('div'); history.id = 'emailDeliveryHistory'; history.setAttribute('aria-live', 'polite');
    card.append(title, button, history); document.querySelector('main')?.append(card); void load();
  });
})();
