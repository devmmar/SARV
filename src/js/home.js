(async ()=>{
  const session = await requireAuth(); if(!session) return;
  const user = session.user;

  await preencherPill(user);
  document.getElementById('logoutBtn')?.addEventListener('click', async e=>{
    e.preventDefault(); await logout();
  });

  const elNotifs   = document.getElementById('notifs');
  const elHistorico= document.getElementById('historico');

  // 1) Carregar notificações (últimas 30)
  async function loadNotifs(){
    const { data, error } = await supa
      .from('notificacoes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending:false })
      .limit(30);
    if (error) { toast(error.message); return; }

    if (!data?.length){
      elNotifs.innerHTML = '<div class="empty">Nenhuma notificação.</div>';
      return;
    }
    elNotifs.innerHTML = data.map(n=>`
      <div class="item">
        <div class="meta">
          <span class="badge">${new Date(n.created_at).toLocaleString('pt-BR')}</span>
          <span class="badge">${n.tipo}</span>
          ${n.lida ? '<span class="badge ok">LIDA</span>' : '<span class="badge warn">NOVA</span>'}
        </div>
        <div style="margin:6px 0 2px"><b>${n.titulo}</b></div>
        <div style="color:#cbd4ff">${n.mensagem}</div>
        <div class="actions">
          ${!n.lida ? `<button class="btn small ghost" onclick="marcarLida('${n.id}')">Marcar como lida</button>`:''}
        </div>
      </div>
    `).join('');
  }

  // 2) Marcar como lida
  window.marcarLida = async (id)=>{
    const { error } = await supa
      .from('notificacoes')
      .update({ lida: true })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) { toast(error.message); return; }
    loadNotifs();
  };

  // 3) Histórico de refeições (últimas 20 reservas)
  async function loadHistorico(){
    const { data, error } = await supa
      .from('reservas')
      .select('id,data,refeicao,status,created_at')
      .eq('user_id', user.id)
      .order('data', { ascending:false })
      .order('created_at', { ascending:false })
      .limit(20);
    if (error) { toast(error.message); return; }

    if (!data?.length){
      elHistorico.innerHTML = '<div class="empty">Nenhuma reserva.</div>';
      return;
    }

    elHistorico.innerHTML = data.map(r=>`
      <div class="item">
        <div class="meta">
          <span class="badge">${fmt.date(r.data)}</span>
          <span class="badge">${r.refeicao}</span>
          <span class="badge ${r.status==='DEFERIDA'?'ok':r.status==='PENDENTE'?'warn':r.status==='CANCELADA'?'danger':''}">
            ${r.status}
          </span>
        </div>
      </div>
    `).join('');
  }

  // 4) Realtime: quando chegar uma nova notificação para este usuário,
  //    mostra um toast e atualiza a lista
  const channel = supa.channel('notifs-realtime')
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notificacoes',
      filter: `user_id=eq.${user.id}`
    }, payload => {
      const n = payload.new;
      toast(`${n.titulo} — ${n.mensagem}`);
      // Prepend rápido (sem recarregar tudo):
      if (elNotifs?.firstChild){
        elNotifs.insertAdjacentHTML('afterbegin', `
          <div class="item">
            <div class="meta">
              <span class="badge">${new Date(n.created_at).toLocaleString('pt-BR')}</span>
              <span class="badge">${n.tipo}</span>
              <span class="badge warn">NOVA</span>
            </div>
            <div style="margin:6px 0 2px"><b>${n.titulo}</b></div>
            <div style="color:#cbd4ff">${n.mensagem}</div>
            <div class="actions">
              <button class="btn small ghost" onclick="marcarLida('${n.id}')">Marcar como lida</button>
            </div>
          </div>
        `);
      }
    })
    .subscribe();

  // 5) Primeira carga
  loadNotifs();
  loadHistorico();
})();
