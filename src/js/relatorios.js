(async () => {
    const session = await requireAuth(); if (!session) return;
    const user = session.user;
    await preencherPill(user);
    document.getElementById('logoutBtn')?.addEventListener('click', async e => { e.preventDefault(); await logout(); });

    // Gate de papel no front (RLS garante no backend):
    const { data: me, error: eMe } = await supa.from('perfis').select('role').eq('id', user.id).maybeSingle();
    if (eMe) { toast(eMe.message); return; }
    if (me?.role !== 'furriel') { toast('Acesso restrito ao Furriel'); location.href = 'home.html'; return; }

    const pendentes = document.getElementById('pendentes');
    const hojeResumo = document.getElementById('hojeResumo');

    async function loadPendentes() {
        const { data, error } = await supa
            .from("v_reservas_perfis")
            .select("id,data,refeicao,status,nome_guerra,pg")
            .eq("status", "PENDENTE")
            .order("data");
        if (error) return toast(error.message);
        pendentes.innerHTML = data?.length ? data.map(r => `
      <div class="item">
        <div class="meta">
          <span class="badge">${fmt.date(r.data)}</span>
          <span class="badge">${r.refeicao}</span>
          <span class="badge">${(r.pg || '').toUpperCase()} ${(r.nome_guerra || '').toUpperCase()}</span>
        </div>
        <div class="actions">
          <button class="btn small" onclick="decidir('${r.id}','DEFERIDA')">Deferir</button>
          <button class="btn small" onclick="decidir('${r.id}','INDEFERIDA')">Indeferir</button>
        </div>
      </div>
    `).join('') : '<div class="empty">Sem pendências.</div>';
    }

    window.decidir = async (id, status) => {
        const { error } = await supa.from('reservas').update({ status }).eq('id', id);
        if (error) return toast(error.message);
        loadPendentes();
    };

    async function gerarHoje() {
        const today = new Date().toISOString().slice(0, 10);
        const { data, error } = await supa
            .from('reservas').select('refeicao').eq('status', 'DEFERIDA').eq('data', today);
        if (error) return toast(error.message);
        const tot = { CAFE: 0, ALMOCO: 0, JANTA: 0 };
        data.forEach(r => tot[r.refeicao] = (tot[r.refeicao] || 0) + 1);
        const ins = await supa.from('relatorios_refeicoes').insert({
            referencia: today,
            total_cafe: tot.CAFE || 0,
            total_almoco: tot.ALMOCO || 0,
            total_janta: tot.JANTA || 0,
            gerado_por: user.id
        });
        if (ins.error) return toast(ins.error.message);
        hojeResumo.textContent = `Gerado para ${fmt.date(today)} — Café: ${tot.CAFE || 0}, Almoço: ${tot.ALMOCO || 0}, Janta: ${tot.JANTA || 0}`;
        toast('Relatório gerado');
    }
    document.getElementById('gerarHoje')?.addEventListener('click', gerarHoje);

    function nomeArquivo({ ini, fim, status }) {
        if (ini && fim) return `arranchamento_${ini}_a_${fim}_${status}.xlsx`;
        const d = ini || fim || new Date().toISOString().slice(0, 10);
        return `arranchamento_${d}_${status}.xlsx`;
    }

    async function exportarExcelArranchamento() {
        const ini = document.getElementById('excelIni')?.value || '';
        const fim = document.getElementById('excelFim')?.value || '';
        const st = document.getElementById('excelStatus')?.value || 'PENDENTE';

        let q = supa.from('v_reservas_perfis')
            .select('data,refeicao,status,nome,email,nome_guerra,pg', { count: 'exact' })
            .order('data').order('refeicao');
        if (ini) q = q.gte('data', ini);
        if (fim) q = q.lte('data', fim);
        if (st === 'TODOS') q = q.neq('status', 'CANCELADA'); else q = q.eq('status', st);

        const { data, error, count } = await q;
        if (error) return toast(error.message);
        if (!data?.length) return toast('Nenhum registro para exportar.');

        const linhas = data.map(r => ({
            "Nome": `${(r.pg || '').toUpperCase()} ${(r.nome_guerra || '').toUpperCase()}`,
            "Data": r.data,
            "Refeição": r.refeicao,
            "Status": r.status
        }));

        const resumoMap = {};
        linhas.forEach(l => { const k = `${l.Data}::${l["Refeição"]}`; resumoMap[k] = (resumoMap[k] || 0) + 1; });
        const resumo = Object.entries(resumoMap).map(([k, v]) => { const [d, ref] = k.split('::'); return { "Data": d, "Refeição": ref, "Total": v }; });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), 'Arranchamentos');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'Resumo');
        XLSX.writeFile(wb, nomeArquivo({ ini, fim, status: st }));
        toast(`Excel gerado (${count} linhas).`);
    }
    document.getElementById('btnExcel')?.addEventListener('click', exportarExcelArranchamento);

    loadPendentes();
})();
