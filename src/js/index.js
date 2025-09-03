const EB = /@eb\.mil\.br$/i;

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = fd.get('email'); const senha = fd.get('senha');

    try {
        if (!EB.test(email)) throw new Error('Use e-mail @eb.mil.br');
        const { error } = await supa.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        location.href = 'home.html';
    } catch (err) { toast(err.message || 'Falha no login'); }
});
