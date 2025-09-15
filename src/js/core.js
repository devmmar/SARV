// src/js/core.js

// ====== CONFIG DO SUPABASE (use suas credenciais públicas) ======
const SUPA_URL  = "https://bloancexsoskmnefpita.supabase.co";
const SUPA_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsb2FuY2V4c29za21uZWZwaXRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NDcwNDYsImV4cCI6MjA3MjQyMzA0Nn0.SRh1avUhhawqM9ge_ggnynSzwL1zE5qCi7OsGfQcA2s";

// ====== SINGLETON DO CLIENTE ======
// Garante que não criamos vários clientes (evita múltiplos websockets)
if (!window.supa) {
  window.supa = supabase.createClient(SUPA_URL, SUPA_ANON);
}

// ====== TOAST (com timer único) ======
(() => {
  let _toastTimer = null;
  window.toast = (msg = "") => {
    const el = document.getElementById("toast");
    if (!el) { alert(msg); return; }
    el.textContent = msg;
    el.style.display = "block";
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { el.style.display = "none"; }, 2500);
  };
})();

// ====== FORMATADORES ======
window.fmt = {
  // aceita "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm:ssZ"
  date: (v) => {
    if (!v) return '';
    const s = String(v);
    const iso = s.length >= 10 ? s.slice(0,10) : s; // pega só YYYY-MM-DD
    const [Y,M,D] = iso.split('-');
    if (!Y || !M || !D) return s;
    return `${D}/${M}/${Y}`;
  },
  datetime: (v) => new Date(v).toLocaleString('pt-BR'), // use só para horários
};

// ====== AUTENTICAÇÃO BÁSICA ======
window.requireAuth = async () => {
  const { data: { session }, error } = await supa.auth.getSession();
  if (error) {
    console.error("getSession error:", error);
  }
  if (!session) { location.href = "index.html"; return null; }
  return session;
};

window.logout = async () => {
  try { await supa.auth.signOut(); }
  finally { location.href = "index.html"; }
};

// ====== PILL (PG + Nome de Guerra) ======
window.preencherPill = async (user) => {
  const pill = document.getElementById("sessionPill");
  if (!pill) return;

  let { pg, nome_guerra } = user.user_metadata || {};
  if (!pg || !nome_guerra) {
    const { data, error } = await supa
      .from("perfis")
      .select("pg, nome_guerra")
      .eq("id", user.id)
      .maybeSingle();
    if (!error && data) {
      pg = pg || data.pg;
      nome_guerra = nome_guerra || data.nome_guerra;
    }
  }
  pill.textContent =
    (pg && nome_guerra)
      ? `${String(pg).toUpperCase()} ${String(nome_guerra).toUpperCase()}`
      : (user.email || "");
};

// ====== GERENCIAMENTO DE CANAIS (Realtime) ======
// - joinChannel: cria/retorna um canal com idempotência (não duplica listeners)
// - leaveChannel: encerra um canal
// - rejoinAll: tenta re-inscrever canais quando a página volta/online/orientação muda
(function initRealtimeCore() {
  if (window._coreBootstrapped) return; // evita registrar handlers múltiplas vezes
  window._coreBootstrapped = true;

  const _channels = new Map(); // name -> channel

  /**
   * Cria (uma única vez) ou reutiliza um canal do Supabase Realtime.
   * @param {string} name - nome único do canal
   * @param {object} params - objeto postgres_changes { event, schema, table, filter }
   * @param {(payload:any)=>void} onChange - callback ao receber evento
   * @returns {RealtimeChannel}
   */
  window.joinChannel = (name, params, onChange) => {
    if (_channels.has(name)) return _channels.get(name);

    const ch = supa.channel(name)
      .on("postgres_changes", params, (payload) => {
        try { onChange?.(payload); } catch (e) { console.error("onChange error", e); }
      })
      .subscribe((status) => {
        // status: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' etc.
        // console.log("[realtime]", name, status);
      });

    _channels.set(name, ch);
    return ch;
  };

  /**
   * Sai de um canal (se existir).
   */
  window.leaveChannel = (name) => {
    const ch = _channels.get(name);
    if (ch) {
      try { ch.unsubscribe(); } catch (e) { /* ignore */ }
      _channels.delete(name);
    }
  };

  /**
   * Tenta re-subscrever todos os canais não-ativos.
   */
  window.rejoinAll = () => {
    _channels.forEach((ch, name) => {
      // ch.state pode variar de acordo com a lib; o importante é garantir subscribe novamente
      try {
        ch.subscribe(); // idempotente; a lib lida com estados internamente
      } catch (e) {
        console.warn("rejoin error", name, e);
      }
    });
  };

  // Exponha para outros scripts
  window._channels = _channels;

  // Resiliência: quando a aba volta, volta conexão; quando online, idem.
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      window.rejoinAll();
    }
  });
  window.addEventListener("online", window.rejoinAll);
  window.addEventListener("resume", window.rejoinAll); // alguns navegadores móveis
  window.addEventListener("orientationchange", () => {
    // pequena espera para o navegador estabilizar após a rotação
    setTimeout(window.rejoinAll, 150);
  });
})();

document.addEventListener('DOMContentLoaded', () => {
  const topbar = document.getElementById('topbarApp');
  const btn = document.getElementById('menuBtn');
  const nav = document.getElementById('primaryNav');

  if (!topbar || !btn || !nav) return;

  function closeMenu() {
    topbar.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    topbar.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
  }

  btn.addEventListener('click', () => {
    const isOpen = topbar.classList.contains('is-open');
    isOpen ? closeMenu() : openMenu();
  });

  // Fecha ao clicar num link do menu (UX melhor em mobile)
  nav.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.tagName === 'A') {
      closeMenu();
    }
  });

  // Se redimensionar para desktop, garante menu fechado/estado limpo
  const MQ = window.matchMedia('(min-width: 981px)');
  MQ.addEventListener('change', (ev) => {
    if (ev.matches) closeMenu();
  });
});
