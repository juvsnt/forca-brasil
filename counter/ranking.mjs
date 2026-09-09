import words from './words.json' with { type: 'json' };

// Recalcula o resultado a partir das letras de cada rodada, sem confiar em pontos enviados.
export function validateGame(data) {
  if (!data || typeof data.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(data.id)) throw new Error('Partida inválida');
  if (typeof data.name !== 'string') throw new Error('Nome inválido');
  const name = data.name.trim();
  if (name.length < 2 || name.length > 24 || /[\u0000-\u001f\u007f<>]/.test(name)) throw new Error('Use um nome ou apelido de 2 a 24 caracteres.');
  if (!Array.isArray(data.rounds) || data.rounds.length < 1 || data.rounds.length > 25) throw new Error('Rodadas inválidas');
  let wins = 0, score = 0, lost = false;
  const used = new Set();
  for (const [i, round] of data.rounds.entries()) {
    const level = Math.floor(i / 5);
    const key = `${level}:${round?.word}`;
    if (!round || !words[level].includes(round.word) || used.has(key)) throw new Error('Palavra inválida');
    used.add(key);
    if (!Array.isArray(round.guesses) || round.guesses.length < 1 || round.guesses.length > 26) throw new Error('Letras inválidas');
    const guesses = new Set();
    let errors = 0, won = false;
    for (const letter of round.guesses) {
      if (won || errors === 6 || typeof letter !== 'string' || !/^[A-Z]$/.test(letter) || guesses.has(letter)) throw new Error('Sequência inválida');
      guesses.add(letter);
      if (!round.word.includes(letter)) errors++;
      won = [...round.word].every(l => l === ' ' || guesses.has(l));
    }
    if (won) { wins++; score += (level + 1) * 100 + (6 - errors) * 10; }
    else if (errors === 6 && i === data.rounds.length - 1) lost = true;
    else throw new Error('Partida ainda não terminou');
  }
  if (!lost && wins !== 25) throw new Error('Partida ainda não terminou');
  return { id: data.id, name, score, wins, level: Math.min(Math.floor(wins / 5) + 1, 5) };
}

const topQuery = 'SELECT name, score, wins, level FROM scores ORDER BY score DESC, wins DESC, created_at ASC, id ASC LIMIT 10';

export async function ranking(request, env, reply) {
  if (request.method === 'GET') {
    const result = await env.DB.prepare(topQuery).all();
    return reply({ entries: result.results });
  }
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return reply({error:'Envie JSON.'},415);
  // Limite durante a leitura, inclusive para corpos sem Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return reply({error:'Partida ausente.'},400);
  let bytes = 0, text = '';
  const decoder = new TextDecoder();
  while (true) {
    const {done,value} = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 16384) { await reader.cancel(); return reply({error:'Partida muito grande.'},413); }
    text += decoder.decode(value,{stream:true});
  }
  text += decoder.decode();
  let game;
  try { game = validateGame(JSON.parse(text)); }
  catch { return reply({error:'Resultado inválido ou partida incompleta.'},400); }
  const results = await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO scores (id, name, score, wins, level) VALUES (?, ?, ?, ?, ?)')
      .bind(game.id, game.name, game.score, game.wins, game.level),
    env.DB.prepare('SELECT name, score, wins, level FROM scores WHERE id = ?').bind(game.id)
  ]);
  const saved = results[1].results[0];
  if (['name','score','wins','level'].some(key => saved[key] !== game[key])) return reply({error:'Identificador de partida já utilizado.'},409);
  return reply({ saved: true, result: saved });
}
