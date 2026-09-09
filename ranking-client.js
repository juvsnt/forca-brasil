// Resultados pendentes são um apoio offline; o ranking exibido vem sempre da Cloudflare.
const GlobalRanking = (() => {
  const storageKey = 'forcaBrasilPendingScores';
  let memory = [], running = null;
  try { const saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(saved)) memory = saved; } catch {}
  function persist() { try { localStorage.setItem(storageKey, JSON.stringify(memory)); } catch {} }
  function enqueue(game) {
    if (!memory.some(x => x.id === game.id)) memory.push(JSON.parse(JSON.stringify(game)));
    persist();
  }
  async function api(method, body) {
    const url = new URL('/ranking', window.FORCA_COUNTER_URL);
    const response = await fetch(url, {
      method, credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(10000),
      ...(body ? {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {})
    });
    if (!response.ok) throw new Error('Serviço indisponível');
    return response.json();
  }
  async function update() {
    const status = document.getElementById('rankStatus');
    const retry = document.getElementById('retryRanking');
    const rows = document.getElementById('rankRows');
    retry.disabled = true;
    status.textContent = memory.length ? 'Enviando seu resultado para o ranking global…' : 'Buscando os melhores resultados…';
    let failed = false, sent = false;
    try {
      while (memory.length) {
        const game = memory[0];
        await api('POST', game);
        memory = memory.filter(x => x.id !== game.id);
        persist(); sent = true;
      }
    } catch { failed = true; }
    try {
      const { entries } = await api('GET');
      if (!Array.isArray(entries)) throw new Error('Resposta inválida');
      rows.replaceChildren();
      if (!entries.length) {
        const tr = document.createElement('tr'), td = document.createElement('td');
        td.colSpan = 5; td.textContent = 'O pódio está esperando. Termine uma partida para participar!';
        tr.appendChild(td); rows.appendChild(tr);
      }
      entries.slice(0,10).forEach((entry,i) => {
        const tr = document.createElement('tr');
        [i < 3 ? ['🥇','🥈','🥉'][i] : i+1, entry.name, entry.wins, entry.level, entry.score].forEach(value => {
          const td = document.createElement('td'); td.textContent = String(value); tr.appendChild(td);
        });
        rows.appendChild(tr);
      });
      status.textContent = failed ? 'Seu resultado ainda não foi enviado. Tente novamente com conexão.' : sent ? 'Resultado salvo! Estes são os 10 melhores resultados globais.' : 'Ranking global atualizado.';
    } catch {
      rows.replaceChildren();
      status.textContent = memory.length ? 'Não foi possível conectar. Seu resultado está pendente neste navegador; tente novamente.' : 'Não foi possível carregar o ranking global. Tente novamente.';
    } finally { retry.disabled = false; }
  }
  function refresh() {
    if (!running) running = update().finally(() => { running = null; });
    return running;
  }
  return { enqueue, refresh };
})();
