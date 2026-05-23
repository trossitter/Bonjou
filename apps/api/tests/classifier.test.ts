import { describe, expect, it } from 'vitest';
import { Severity } from '@prisma/client';
import { classifyIssue } from '../src/services/classifier';
import { detectLanguage } from '../src/services/language';

describe('field message helpers', () => {
  it('detects Haitian Creole hints', () => {
    expect(detectLanguage('Mwen pa ka konekte depi maten an').language).toBe('ht');
  });

  it('classifies cash-impacting reports as critical', () => {
    const result = classifyIssue('Kliyan yo pa ka depoze lajan', 'PAP-014');
    expect(result.severity).toBe(Severity.CRITICAL);
    expect(result.category).toBe('transaction_failure');
  });
});
