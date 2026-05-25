export type SupportedLanguage = 'ht' | 'fr' | 'es' | 'en' | 'unknown';

const HAITIAN_CREOLE_HINTS = [
  'mwen', 'ou', 'li', 'nou', 'yo', 'pa', 'ka', 'ap', 'gen', 'depi', 'fè', 'fe', 'lajan', 'kliyan',
  'retrè', 'retre', 'depoze', 'mache', 'branch', 'tanpri', 'pari', 'genyen', 'sistèm', 'rezilta', 'goud'
];
const FRENCH_HINTS = [
  'bonjour', 'merci', 'problème', 'probleme', 'connexion', 'retrait', 'dépôt', 'depôt', 'client',
  'impossible', 'système', 'systeme', 'résultat', 'gains', 'paris', 'compte'
];
const SPANISH_HINTS = [
  'hola', 'gracias', 'retiro', 'depósito', 'deposito', 'cliente', 'no puedo', 'aplicación',
  'sucursal', 'apuesta', 'apostar', 'cuota', 'sistema', 'resultado'
];

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : 1 + Math.min(row[j - 1], row[j], prev);
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

function score(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  const tokens = lower.split(/\s+/);
  return words.reduce((total, hint) => {
    if (lower.includes(hint)) return total + 1;
    // Allow 1-edit fuzzy match for hints of 5+ chars (handles keyboard misspellings)
    if (hint.length >= 5 && tokens.some(t => Math.abs(t.length - hint.length) <= 1 && levenshtein(t, hint) <= 1)) {
      return total + 0.7;
    }
    return total;
  }, 0);
}

export function detectLanguage(text: string): { language: SupportedLanguage; confidence: number } {
  const ht = score(text, HAITIAN_CREOLE_HINTS);
  const fr = score(text, FRENCH_HINTS);
  const es = score(text, SPANISH_HINTS);
  const asciiRatio = text.replace(/[^a-zA-Z]/g, '').length / Math.max(text.length, 1);

  const max = Math.max(ht, fr, es);
  if (max === 0) {
    return { language: asciiRatio > 0.55 ? 'en' : 'unknown', confidence: 0.45 };
  }
  if (max === ht) return { language: 'ht', confidence: Math.min(0.95, 0.55 + ht * 0.08) };
  if (max === fr) return { language: 'fr', confidence: Math.min(0.9, 0.55 + fr * 0.08) };
  return { language: 'es', confidence: Math.min(0.9, 0.55 + es * 0.08) };
}
