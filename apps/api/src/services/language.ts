export type SupportedLanguage = 'ht' | 'fr' | 'es' | 'en' | 'unknown';

const HAITIAN_CREOLE_HINTS = [
  'mwen', 'ou', 'li', 'nou', 'yo', 'pa', 'ka', 'ap', 'gen', 'depi', 'fè', 'fe', 'lajan', 'kliyan', 'retrè', 'retre', 'depoze', 'mache', 'branch', 'tanpri'
];
const FRENCH_HINTS = ['bonjour', 'merci', 'problème', 'probleme', 'connexion', 'retrait', 'dépôt', 'depôt', 'client', 'impossible'];
const SPANISH_HINTS = ['hola', 'gracias', 'retiro', 'depósito', 'deposito', 'cliente', 'no puedo', 'aplicación', 'sucursal'];

function score(text: string, words: string[]) {
  const lower = ` ${text.toLowerCase()} `;
  return words.reduce((count, word) => count + (lower.includes(` ${word} `) || lower.includes(word) ? 1 : 0), 0);
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
