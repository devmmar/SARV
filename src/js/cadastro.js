const EB_REGEX = /^[^@\s]+@eb\.mil\.br$/i;

document.getElementById('cadForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nome = fd.get('nome')?.toString().trim();
    const nome_guerra = fd.get('nome_guerra')?.toString().trim().toUpperCase();
    const pg = fd.get('pg')?.toString().trim();
    const email = fd.get('email')?.toString().trim();
    const senha = fd.get('senha')?.toString();
    const confirm = fd.get('confirm')?.toString();

    try {
        if (!EB_REGEX.test(email)) throw new Error('Use e-mail @eb.mil.br');
        if ((senha || '').length < 6) throw new Error('Senha mínima 6');
        if (senha !== confirm) throw new Error('As senhas não conferem');
        if (!nome || !nome_guerra || !pg) throw new Error('Preencha Nome, Nome de Guerra e PG');

        const { data, error } = await supa.auth.signUp({
            email, password: senha, options: { data: { role: 'militar', pg, nome_guerra } }
        });
        if (error) throw error;

        const user = data.user;
        if (user) {
            const { error: perErr } = await supa.from('perfis').upsert({
                id: user.id, email, nome, nome_guerra, pg, role: 'militar'
            });
            if (perErr) throw perErr;
            await supa.auth.updateUser({ data: { role: 'militar', pg, nome_guerra } }).catch(() => { });
            toast('Conta criada! Faça login.');
            setTimeout(() => location.href = 'index.html', 800);
        } else {
            toast('Verifique seu e-mail para confirmar o cadastro.');
        }
    } catch (err) { toast(err.message || 'Falha no cadastro'); }
});
