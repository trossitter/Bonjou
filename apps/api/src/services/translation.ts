import { env } from '../env';
import { detectLanguage, SupportedLanguage } from './language';

export interface TranslationResult {
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  originalText: string;
  translatedText: string;
  confidence: number;
  provider: string;
}

const demoDictionary: Record<string, string> = {
  'app la fèmen chak fwa mwen eseye fè retrè pou kliyan an': 'The app closes every time I try to process a customer withdrawal.',
  'mwen pa ka konekte. login lan pa mache depi maten an.': 'I cannot log in. The login has not worked since this morning.',
  'pos la pa mache. kliyan yo pa ka depoze lajan.': 'The POS is not working. Customers cannot deposit money.',
  'lotri a pran twòp tan pou afiche rezilta yo': 'The lottery is taking too long to post the results.'
};

function mockTranslate(text: string, source: SupportedLanguage, target: SupportedLanguage): string {
  if (source === target || target === 'unknown') return text;
  const key = text.trim().toLowerCase();
  if (target === 'en' && demoDictionary[key]) return demoDictionary[key];
  if (target === 'ht' && source === 'en') return `[Kreyòl translation] ${text}`;
  if (target === 'fr' && source === 'en') return `[Traduction française] ${text}`;
  if (target === 'es' && source === 'en') return `[Traducción al español] ${text}`;
  return `[${source} → ${target}] ${text}`;
}

async function openAITranslate(text: string, source: SupportedLanguage, target: SupportedLanguage): Promise<string> {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      input: [
        {
          role: 'system',
          content: 'Translate operational fintech support messages. Preserve branch IDs, transaction vocabulary, names, numbers, and urgency. Return only the translation.'
        },
        {
          role: 'user',
          content: `Translate from ${source} to ${target}:\n\n${text}`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI translation failed: ${response.status}`);
  }
  const json = await response.json() as { output_text?: string };
  return json.output_text?.trim() || text;
}

export async function translateText(text: string, targetLanguage: SupportedLanguage = 'en', sourceLanguage?: SupportedLanguage): Promise<TranslationResult> {
  const detected = sourceLanguage ? { language: sourceLanguage, confidence: 0.8 } : detectLanguage(text);
  let translatedText = text;
  let provider: string = env.TRANSLATION_PROVIDER;
  let confidence = detected.confidence;

  try {
    if (env.TRANSLATION_PROVIDER === 'openai') {
      translatedText = await openAITranslate(text, detected.language, targetLanguage);
      confidence = Math.max(confidence, 0.82);
    } else {
      translatedText = mockTranslate(text, detected.language, targetLanguage);
      provider = env.TRANSLATION_PROVIDER === 'demo' ? 'demo' : 'mock';
    }
  } catch (error) {
    translatedText = mockTranslate(text, detected.language, targetLanguage);
    provider = 'mock-fallback';
    confidence = Math.min(confidence, 0.62);
  }

  return {
    sourceLanguage: detected.language,
    targetLanguage,
    originalText: text,
    translatedText,
    confidence,
    provider
  };
}
