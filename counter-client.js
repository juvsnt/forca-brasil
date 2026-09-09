async function loadVisitorCount() {
  const endpoint = window.FORCA_COUNTER_URL;
  if (!endpoint) return;
  const badge = document.getElementById('visitorBadge');
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error('Contador indisponível');
    const { count } = await response.json();
    if (!Number.isSafeInteger(count) || count < 1) throw new Error('Contagem inválida');
    document.getElementById('visitorCount').textContent = count.toLocaleString('pt-BR');
    document.getElementById('visitorNoun').textContent = count === 1 ? 'visitante já entrou' : 'visitantes já entraram';
    badge.hidden = false;
  } catch {
    // Uma falha no contador não interrompe o jogo nem apresenta um número inventado.
    badge.hidden = true;
  }
}
loadVisitorCount();
