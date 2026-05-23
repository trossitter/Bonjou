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

  if (/withdraw|deposit|transaction|retr[eè]|depo|lajan|cash|payment/.test(t)) {
    return {
      severity: Severity.CRITICAL,
      category: 'transaction_failure',
      issueKey: /withdraw|retr/.test(t) ? 'transaction_failure:withdrawal' : 'transaction_failure:deposit',
      title: `Customer transaction blocked${branch}`,
      summary: 'Agent reports that customers may be blocked from depositing or withdrawing money.'
    };
  }

  if (/crash|closes|f[èe]men|freeze|frozen|blank|app/.test(t)) {
    return {
      severity: Severity.HIGH,
      category: 'app_crash',
      issueKey: 'app_crash',
      title: `App crash or freeze reported${branch}`,
      summary: 'Agent reports app crash, freeze, or forced close.'
    };
  }

  if (/login|log in|connect|konekte|password|otp/.test(t)) {
    return {
      severity: Severity.HIGH,
      category: 'login_access',
      issueKey: 'login_access',
      title: `Login issue reported${branch}`,
      summary: 'Agent reports being unable to log in or authenticate.'
    };
  }

  if (/internet|network|connection|connexion|signal|data|wifi/.test(t)) {
    return {
      severity: Severity.MEDIUM,
      category: 'connectivity',
      issueKey: 'connectivity',
      title: `Connectivity issue reported${branch}`,
      summary: 'Agent reports network, signal, or connectivity problems.'
    };
  }

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
