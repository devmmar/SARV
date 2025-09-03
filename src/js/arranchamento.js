(async () => {
    const session = await requireAuth(); if (!session) return;
    const user = session.user;
    await preencherPill(user);
    document.getElementById('logoutBtn')?.addEventListener('click', async e => { e.preventDefault(); await logout(); });

    const lista = document.getElementById('lista');
    const form = document.getElementById('resForm');

    async function loadReservas() {
        const { data, error } = await supa.from('reservas')
            .select('id,data,refeicao,status,created_at')
            .eq('user_id', user.id)
            .order('data', { ascending: false })
            .order('created_at', { ascending: false });
        if (error) return toast(error.message);
        if (!data?.length) { lista.innerHTML = `<div class="empty">Você ainda não tem reservas.</div>`; return; }
        lista.innerHTML = data.map(r => `
      <div class="item">
        <div class="meta">
          <span class="badge">${fmt.date(r.data)}</span>
          <span class="badge">${r.refeicao}</span>
          <span class="badge ${r.status === 'DEFERIDA' ? 'ok' : r.status === 'PENDENTE' ? 'warn' : ''}">${r.status}</span>
        </div>
        ${r.status !== 'CANCELADA' ? `<div class="actions">
          <button class="btn small" onclick="cancelar('${r.id}')">Cancelar</button>
        </div>` : ``}
      </div>
    `).join('');
    }

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = { user_id: user.id, data: fd.get('data'), refeicao: fd.get('refeicao'), status: 'PENDENTE' };
        if (!payload.data) return toast('Escolha uma data');
        const { error } = await supa.from('reservas').insert(payload);
        if (error) return toast(error.message);
        toast('Reserva registrada.');
        form.reset(); loadReservas();
    });

    window.cancelar = async (id) => {
        const { error } = await supa.from('reservas')
            .update({ status: 'CANCELADA' })
            .eq('id', id).eq('user_id', user.id);
        if (error) return toast(error.message);
        loadReservas();
    };

    loadReservas();
})();
