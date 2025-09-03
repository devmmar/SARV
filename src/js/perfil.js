(async () => {
    const session = await requireAuth(); if (!session) return;
    const user = session.user;
    await preencherPill(user);
    document.getElementById('logoutBtn')?.addEventListener('click', async e => { e.preventDefault(); await logout(); });

    const form = document.getElementById('perfilForm');

    const { data } = await supa.from('perfis').select('*').eq('id', user.id).maybeSingle();
    if (data) {
        form.nome.value = data.nome || '';
        form.nome_guerra.value = data.nome_guerra || '';
        form.pg.value = data.pg || '';
        form.role.value = data.role || 'militar';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = {
            id: user.id,
            nome: fd.get('nome')?.toString(),
            nome_guerra: (fd.get('nome_guerra') || '').toString().toUpperCase(),
            pg: fd.get('pg')?.toString(),
            role: form.role.value || 'militar'
        };
        const { error } = await supa.from('perfis').upsert(payload);
        if (error) return toast(error.message);
        await supa.auth.updateUser({ data: { pg: payload.pg, nome_guerra: payload.nome_guerra } }).catch(() => { });
        toast('Perfil atualizado.');
        await preencherPill(user);
    });
})();
