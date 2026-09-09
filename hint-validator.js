const forbiddenHintTerms = ['esporte','cultura','lazer','comida','país','estados','cidades','capitais','televisão','tradição','doce','música','culinária','fruta','geografia','folclore','natureza','cotidiano','fauna','história','literatura'];

function hintWords(text) { return text.trim().split(/\s+/).filter(Boolean); }
function normalizeHint(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(); }
function hintIsValid(text, secret, category) {
  if (typeof text !== 'string' || hintWords(text).length < 8 || hintWords(text).length > 20) return false;
  const normalized = normalizeHint(text);
  const answer = normalizeHint(secret).replace(/\s+/g, '');
  if (!answer || normalized.includes(answer)) return false;
  const hasWholeTerm = term => new RegExp(`(?:^|[^A-Z])${normalizeHint(term)}(?:$|[^A-Z])`).test(normalized);
  if (forbiddenHintTerms.some(hasWholeTerm)) return false;
  if (category && hasWholeTerm(category)) return false;
  // Não revelar a inicial, o tamanho ou um padrão literal da resposta.
  if (normalized.match(new RegExp(`\\b${answer[0]}\\b`))) return false;
  if (/\b(primeira letra|começa com|inicia com|tem \d+ letras|\d+ letras)\b/i.test(text)) return false;
  return true;
}

function safeHint(secret) {
  const templates = [
    'Observe a cena imaginada: um detalhe marcante ajuda a lembrar o significado desta palavra.',
    'Pense em uma situação comum em que essa palavra costuma aparecer naturalmente no dia a dia.',
    'Uma característica conhecida ajuda a reconhecer a ideia por trás desta palavra sem entregar a resposta.',
    'Imagine seu uso em uma conversa brasileira; o contexto revela o caminho, mas preserva o desafio.'
  ];
  const index = [...normalizeHint(secret)].reduce((total, char) => total + char.charCodeAt(0), 0) % templates.length;
  return templates.find((template, position) => position === index && hintIsValid(template, secret, '')) || templates[index];
}

function getHintText(secret, category) {
  // As dicas fornecidas pelo autor são a fonte oficial e devem ser exibidas integralmente.
  return hints[secret] || safeHint(secret);
}
