import { Severity } from '@prisma/client';

export interface Classification {
  severity: Severity;
  category: string;
  issueKey: string;
  title: string;
  summary: string;
}

export function classifyIssue(text: string, branchId?: string | null): Classification {
  const t = text.toLowerCase();
  const branch = branchId ? ` at ${branchId}` : '';

  // Payout / withdrawal / winnings blocked
  if (/payout|genyen|gagner|gains|winnings|can.t.collect|retire.*kòb|retire.*goud|kòb.*paka|lajan.*pa.vini/.test(t)) {
    return {
      severity: Severity.CRITICAL,
      category: 'payout_failure',
      issueKey: 'payout_failure',
      title: `Payout blocked${branch}`,
      summary: 'Agent reports winning customers cannot collect payouts.'
    };
  }

  // Transaction / deposit / cash
  if (/withdraw|deposit|transaction|retr[eè]|depo|lajan|cash|payment|retir|goud/.test(t)) {
    return {
      severity: Severity.CRITICAL,
      category: 'transaction_failure',
      issueKey: /withdraw|retr/.test(t) ? 'transaction_failure:withdrawal' : 'transaction_failure:deposit',
      title: `Customer transaction blocked${branch}`,
      summary: 'Agent reports that customers may be blocked from depositing or withdrawing money.'
    };
  }

  // Betting system down / bets not accepted
  if (/pari|paris|bet\b|bets\b|apostar|apuesta|aksepte.*pari|sistèm.*pa.*aksepte|hors.ligne|offline|pa.*ka.*pran/.test(t)) {
    return {
      severity: Severity.CRITICAL,
      category: 'betting_ops',
      issueKey: 'betting_ops:acceptance',
      title: `Bet acceptance failure${branch}`,
      summary: 'Agent reports the system is not accepting bets — possible during live match.'
    };
  }

  // Crash / freeze / app down
  if (/crash|closes|f[èe]men|femen|freeze|frozen|blank|app\b|apli[ak]syon|apliasyon|sistèm|syst[eè]me|hors.ligne/.test(t)) {
    return {
      severity: Severity.HIGH,
      category: 'app_crash',
      issueKey: 'app_crash',
      title: `App crash or freeze reported${branch}`,
      summary: 'Agent reports app crash, freeze, or forced close.'
    };
  }

  // Login / access
  if (/login|log.?in|connect|konekte|conekte|password|otp|compte.*suspen|kont.*bloke/.test(t)) {
    return {
      severity: Severity.HIGH,
      category: 'login_access',
      issueKey: 'login_access',
      title: `Login issue reported${branch}`,
      summary: 'Agent reports being unable to log in or authenticate.'
    };
  }

  // Odds / results
  if (/odds|cote|cuota|rezilta|r[eé]sultat|resultado|move.*rezilta|mauvais.*r[eé]sultat|wrong.*result/.test(t)) {
    return {
      severity: Severity.HIGH,
      category: 'odds_results',
      issueKey: 'odds_results',
      title: `Odds or results discrepancy${branch}`,
      summary: 'Agent reports odds are stale or match results are displaying incorrectly.'
    };
  }

  // Connectivity
  if (/internet|network|connection|connexion|conection|signal|data|wifi/.test(t)) {
    return {
      severity: Severity.MEDIUM,
      category: 'connectivity',
      issueKey: 'connectivity',
      title: `Connectivity issue reported${branch}`,
      summary: 'Agent reports network, signal, or connectivity problems.'
    };
  }

  // Lottery / general ops
  if (/lottery|lotri|results|rezilta/.test(t)) {
    return {
      severity: Severity.LOW,
      category: 'operations_complaint',
      issueKey: 'ops:lottery_results',
      title: `Lottery results delay reported${branch}`,
      summary: 'Agent reports that lottery results are taking too long to post.'
    };
  }

  return {
    severity: Severity.MEDIUM,
    category: 'general',
    issueKey: 'general',
    title: `Field report${branch}`,
    summary: 'Agent sent a general field report that needs triage.'
  };
}
