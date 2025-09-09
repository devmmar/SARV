(async () => {
  // autenticação básica
  const session = await requireAuth(); if (!session) return;
  const user = session.user;

  await preencherPill(user);
  document.getElementById('logoutBtn')?.addEventListener('click', async e => {
    e.preventDefault(); await logout();
  });

  let elNotifs = document.getElementById('notifs');
  let elHistorico = document.getElementById('historico');

  // helper: divide array em lotes
  function chunk(arr, size) {
    let out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  // =========================
  // NOTIFICAÇÕES
  // =========================
  async function loadNotifs() {
    let { data, error } = await supa
      .from('notificacoes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) { toast(error.message); return; }

    if (!data?.length) {
      elNotifs.innerHTML = '<div class="empty">Nenhuma notificação.</div>';
      return;
    }

    elNotifs.innerHTML = data.map(n => `
      <div class="item" data-id="${n.id}">
        <div class="meta">
          <span class="badge">${new Date(n.created_at).toLocaleString('pt-BR')}</span>
          <span class="badge">${n.tipo}</span>
          ${n.lida ? '<span class="badge ok">LIDA</span>' : '<span class="badge warn">NOVA</span>'}
        </div>
        <div style="margin:6px 0 2px"><b>${n.titulo}</b></div>
        <div style="color:#cbd4ff">${n.mensagem}</div>
        <div class="actions" style="display:flex; gap:8px; margin-top:8px">
          ${!n.lida ? `<button class="btn small ghost" onclick="marcarLida('${n.id}')">Marcar como lida</button>` : ''}
          <button class="btn small danger" onclick="excluirNotif('${n.id}')">Excluir</button>
        </div>
      </div>
    `).join('');
  }

  // marcar como lida
  window.marcarLida = async (id) => {
    let { error } = await supa
      .from('notificacoes')
      .update({ lida: true })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) { toast(error.message); return; }
    loadNotifs();
  };

  // excluir 1 notificação
  window.excluirNotif = async (id) => {
    if (!confirm('Excluir esta notificação?')) return;
    const { error } = await supa
      .from('notificacoes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) { toast(error.message); return; }

    const el = elNotifs.querySelector(`[data-id="${id}"]`);
    if (el) el.remove();

    // NÃO recarrega. Se ficou vazia, mostra "Nenhuma notificação."
    if (!elNotifs.querySelector('.item')) {
      elNotifs.innerHTML = '<div class="empty">Nenhuma notificação.</div>';
    }
  };


  // excluir TODAS as notificações (em lotes por id)
  window.excluirTodas = async () => {
    if (!confirm('Excluir TODAS as notificações? Esta ação não pode ser desfeita.')) return;

    let { data: rows, error: qErr } = await supa
      .from('notificacoes')
      .select('id')
      .eq('user_id', user.id)
      .limit(10000);

    if (qErr) { toast(qErr.message); return; }
    if (!rows?.length) { toast('Não há notificações para excluir.'); return; }

    let ids = rows.map(r => r.id);
    let groups = chunk(ids, 200);

    for (let g of groups) {
      let { error: dErr } = await supa
        .from('notificacoes')
        .delete()
        .in('id', g)
        .eq('user_id', user.id);
      if (dErr) { toast('Falha ao excluir algumas notificações: ' + dErr.message); break; }
    }

    await loadNotifs();
    toast('Notificações excluídas.');
  };

  // excluir todas as notificações LIDAS (em lotes por id)
  window.excluirLidas = async () => {
    if (!confirm('Excluir todas as notificações LIDAS?')) return;

    let { data: rows, error: qErr } = await supa
      .from('notificacoes')
      .select('id')
      .eq('user_id', user.id)
      .eq('lida', true)
      .limit(10000);

    if (qErr) { toast(qErr.message); return; }
    if (!rows?.length) { toast('Não há notificações lidas para excluir.'); return; }

    let ids = rows.map(r => r.id);
    let groups = chunk(ids, 200);

    for (let g of groups) {
      let { error: dErr } = await supa
        .from('notificacoes')
        .delete()
        .in('id', g)
        .eq('user_id', user.id);
      if (dErr) { toast('Falha ao excluir algumas notificações: ' + dErr.message); break; }
    }

    await loadNotifs();
    toast('Notificações lidas excluídas.');
  };

  // realtime: novas notificações
  let channel = supa.channel('notifs-realtime')
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notificacoes',
      filter: `user_id=eq.${user.id}`
    }, payload => {
      let n = payload.new;
      toast(`${n.titulo} — ${n.mensagem}`);
      if (elNotifs) {
        elNotifs.insertAdjacentHTML('afterbegin', `
          <div class="item" data-id="${n.id}">
            <div class="meta">
              <span class="badge">${new Date(n.created_at).toLocaleString('pt-BR')}</span>
              <span class="badge">${n.tipo}</span>
              <span class="badge warn">NOVA</span>
            </div>
            <div style="margin:6px 0 2px"><b>${n.titulo}</b></div>
            <div style="color:#cbd4ff">${n.mensagem}</div>
            <div class="actions" style="display:flex; gap:8px; margin-top:8px">
              <button class="btn small ghost" onclick="marcarLida('${n.id}')">Marcar como lida</button>
              <button class="btn small danger" onclick="excluirNotif('${n.id}')">Excluir</button>
            </div>
          </div>
        `);
      }
    })
    .subscribe();

  // =========================
  // HISTÓRICO (RESERVAS)
  // =========================
  async function loadHistorico() {
    let { data, error } = await supa
      .from('reservas')
      .select('id,data,refeicao,status,created_at')
      .eq('user_id', user.id)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) { toast(error.message); return; }

    if (!data?.length) {
      elHistorico.innerHTML = '<div class="empty">Nenhuma reserva.</div>';
      return;
    }

    elHistorico.innerHTML = data.map(r => `
      <div class="item" data-rid="${r.id}">
        <div class="meta">
          <span class="badge">${fmt.date(r.data)}</span>
          <span class="badge">${r.refeicao}</span>
          <span class="badge ${r.status === 'DEFERIDA' ? 'ok' : r.status === 'PENDENTE' ? 'warn' : r.status === 'CANCELADA' ? 'danger' : ''}">
            ${r.status}
          </span>
        </div>
        <div class="actions" style="display:flex; gap:8px; margin-top:8px">
          ${r.status !== 'CANCELADA' ? `<button class="btn small ghost" onclick="cancelarReserva('${r.id}')">Cancelar</button>` : ''}
          <button class="btn small danger" onclick="excluirReserva('${r.id}')">Excluir</button>
        </div>
      </div>
    `).join('');
  }

  // cancelar (atualiza status)
  window.cancelarReserva = async (id) => {
    let { error } = await supa
      .from('reservas')
      .update({ status: 'CANCELADA' })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) { toast(error.message); return; }
    loadHistorico();
  };

  // excluir 1 reserva
  window.excluirReserva = async (id) => {
  if (!confirm('Excluir esta reserva do histórico?')) return;
  const { error } = await supa
    .from('reservas')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) { toast(error.message); return; }

  const el = elHistorico.querySelector(`[data-rid="${id}"]`);
  if (el) el.remove();

  // NÃO recarrega. Se ficou vazio, mostra "Nenhuma reserva."
  if (!elHistorico.querySelector('.item')) {
    elHistorico.innerHTML = '<div class="empty">Nenhuma reserva.</div>';
  }
};


  // excluir TODAS as reservas (limpar histórico)
  window.excluirHistoricoTudo = async () => {
  if (!confirm('Excluir TODAS as reservas do histórico? Esta ação não pode ser desfeita.')) return;

  let offset = 0, pageSize = 1000, totalApagados = 0;

  while (true) {
    const { data: rows, error: qErr, count } = await supa
      .from('reservas')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .range(offset, offset + pageSize - 1);

    if (qErr) { toast(qErr.message); return; }
    if (!rows?.length) break;

    // apaga em lotes por id (RLS-friendly)
    const ids = rows.map(r => r.id);
    for (const g of chunk(ids, 200)) {
      const { error: dErr } = await supa
        .from('reservas')
        .delete()
        .in('id', g)
        .eq('user_id', user.id);
      if (dErr) { toast('Falha ao excluir algumas reservas: ' + dErr.message); return; }
    }

    totalApagados += rows.length;
    // avança para a próxima página restante (não some offset, pois os próximos “deslizam”)
    // estratégia simples: recomeça do zero até não haver mais registros
    offset = 0;
  }

  await loadHistorico();
  toast(`Histórico limpo. Registros apagados: ${totalApagados}.`);
};

  // excluir somente CANCELADAS
  window.excluirHistoricoCanceladas = async () => {
    if (!confirm('Excluir todas as reservas CANCELADAS do histórico?')) return;

    let { data: rows, error: qErr } = await supa
      .from('reservas')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'CANCELADA')
      .limit(10000);

    if (qErr) { toast(qErr.message); return; }
    if (!rows?.length) { toast('Não há reservas canceladas para excluir.'); return; }

    let ids = rows.map(r => r.id);
    for (let g of chunk(ids, 200)) {
      let { error: dErr } = await supa
        .from('reservas')
        .delete()
        .in('id', g)
        .eq('user_id', user.id);
      if (dErr) { toast('Falha ao excluir algumas reservas: ' + dErr.message); break; }
    }
    await loadHistorico();
    toast('Reservas canceladas excluídas.');
  };

  // primeira carga
  loadNotifs();
  loadHistorico();
})();
