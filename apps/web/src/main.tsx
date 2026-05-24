import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import './styles.css';

type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type Status = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_AGENT' | 'RESOLVED';
type Direction = 'INBOUND' | 'OUTBOUND' | 'INTERNAL';

interface Agent {
  id: string;
  phoneNumber: string;
  displayName?: string;
  branchId?: string;
  region?: string;
  preferredLanguage: string;
}

interface Message {
  id: string;
  direction: Direction;
  bodyOriginal: string;
  bodyTranslated?: string;
  language: string;
  confidence: number;
  createdAt: string;
}

interface Ticket {
  id: string;
  shortCode: string;
  title: string;
  summary?: string;
  status: Status;
  severity: Severity;
  category: string;
  issueKey: string;
  branchId?: string;
  region?: string;
  language: string;
  updatedAt: string;
  agent: Agent;
  messages: Message[];
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const ACCESS_TOKEN_STORAGE_KEY = 'bonjou.dashboardAccessToken';

function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge ${tone ?? ''}`}>{children}</span>;
}

function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'ALL'>('ALL');
  const [accessTokenInput, setAccessTokenInput] = useState(() => localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? '');
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? '');
  const [authRequired, setAuthRequired] = useState(false);
  const visibleTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesStatus = statusFilter === 'ALL' || ticket.status === statusFilter;
      const matchesSeverity = severityFilter === 'ALL' || ticket.severity === severityFilter;
      const searchableText = [
        ticket.shortCode,
        ticket.title,
        ticket.summary,
        ticket.status,
        ticket.severity,
        ticket.category,
        ticket.issueKey,
        ticket.branchId,
        ticket.region,
        ticket.language,
        ticket.agent.displayName,
        ticket.agent.phoneNumber,
        ...ticket.messages.flatMap((message) => [message.bodyOriginal, message.bodyTranslated, message.language])
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);
      return matchesStatus && matchesSeverity && matchesQuery;
    });
  }, [query, severityFilter, statusFilter, tickets]);
  const selected = useMemo(() => visibleTickets.find((ticket) => ticket.id === selectedId) ?? visibleTickets[0], [visibleTickets, selectedId]);

  function authHeaders(): HeadersInit {
    return accessToken ? { 'x-dashboard-access-token': accessToken } : {};
  }

  function handleUnauthorized(response: Response) {
    if (response.status === 401) {
      setAuthRequired(true);
      return true;
    }
    return false;
  }

  async function loadTickets() {
    const response = await fetch(`${API_BASE}/api/tickets`, { headers: authHeaders() });
    if (handleUnauthorized(response)) return;
    const data = await response.json();
    setAuthRequired(false);
    setTickets(data.tickets);
    setSelectedId((current) => current ?? data.tickets?.[0]?.id ?? null);
  }

  useEffect(() => {
    loadTickets();
    const socket = io(API_BASE || undefined);
    socket.on('ticket:update', (ticket: Ticket) => {
      setTickets((current) => {
        const exists = current.some((item) => item.id === ticket.id);
        const next = exists ? current.map((item) => item.id === ticket.id ? ticket : item) : [ticket, ...current];
        return next.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
      });
    });
    socket.on('message:new', loadTickets);
    return () => { socket.disconnect(); };
  }, [accessToken]);

  async function updateTicket(partial: Partial<Pick<Ticket, 'status' | 'severity'>>) {
    if (!selected) return;
    const response = await fetch(`${API_BASE}/api/tickets/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(partial)
    });
    if (handleUnauthorized(response)) return;
    const data = await response.json();
    setTickets((current) => current.map((ticket) => ticket.id === selected.id ? data.ticket : ticket));
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    const response = await fetch(`${API_BASE}/api/tickets/${selected.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ body: reply })
    });
    if (handleUnauthorized(response)) return;
    setReply('');
    await loadTickets();
  }

  async function simulate() {
    const response = await fetch(`${API_BASE}/dev/simulate-inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        from: `50937${Math.floor(100000 + Math.random() * 900000)}`,
        text: 'POS la pa mache. Kliyan yo pa ka depoze lajan.',
        name: 'Demo Agent',
        branchId: 'PAP-099',
        region: 'Port-au-Prince'
      })
    });
    if (handleUnauthorized(response)) return;
  }

  function saveAccessToken(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = accessTokenInput.trim();
    if (trimmed) {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }
    setAccessToken(trimmed);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Designed by Thalia</p>
          <h1>Bonjou</h1>
          <p>WhatsApp-native field ops inbox for Haiti</p>
        </div>
        <button onClick={simulate}>Simulate Kreyòl ticket</button>
      </header>

      {authRequired && (
        <form className="accessGate" onSubmit={saveAccessToken}>
          <label htmlFor="dashboardAccessToken">Demo access token</label>
          <input
            id="dashboardAccessToken"
            value={accessTokenInput}
            onChange={(event) => setAccessTokenInput(event.target.value)}
            type="password"
            autoComplete="off"
          />
          <button type="submit">Unlock</button>
        </form>
      )}

      <section className="metrics">
        <div><strong>{tickets.filter(t => t.status !== 'RESOLVED').length}</strong><span>Open</span></div>
        <div><strong>{tickets.filter(t => t.severity === 'CRITICAL').length}</strong><span>Critical</span></div>
        <div><strong>{new Set(tickets.map(t => t.issueKey)).size}</strong><span>Issue patterns</span></div>
      </section>

      <section className="workspace">
        <aside className="ticketList">
          <div className="ticketFilters">
            <input
              aria-label="Search tickets"
              placeholder="Search tickets"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as Status | 'ALL')}>
              <option value="ALL">All status</option>
              {['OPEN', 'IN_PROGRESS', 'WAITING_ON_AGENT', 'RESOLVED'].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select aria-label="Filter by severity" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as Severity | 'ALL')}>
              <option value="ALL">All severity</option>
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((severity) => <option key={severity} value={severity}>{severity}</option>)}
            </select>
          </div>

          {visibleTickets.map((ticket) => (
            <button key={ticket.id} onClick={() => setSelectedId(ticket.id)} className={ticket.id === selected?.id ? 'active ticketCard' : 'ticketCard'}>
              <span className="row"><strong>{ticket.shortCode}</strong><Badge tone={ticket.severity.toLowerCase()}>{ticket.severity}</Badge></span>
              <span>{ticket.title}</span>
              <small>{ticket.agent.displayName ?? ticket.agent.phoneNumber} · {ticket.branchId ?? 'No branch'}</small>
            </button>
          ))}
          {tickets.length > 0 && visibleTickets.length === 0 && <p className="emptyState">No tickets match filters.</p>}
        </aside>

        {selected && (
          <article className="conversation">
            <div className="conversationHeader">
              <div>
                <h2>{selected.title}</h2>
                <p>{selected.summary}</p>
              </div>
              <div className="controls">
                <select value={selected.status} onChange={(e) => updateTicket({ status: e.target.value as Status })}>
                  {['OPEN', 'IN_PROGRESS', 'WAITING_ON_AGENT', 'RESOLVED'].map((status) => <option key={status}>{status}</option>)}
                </select>
                <select value={selected.severity} onChange={(e) => updateTicket({ severity: e.target.value as Severity })}>
                  {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((severity) => <option key={severity}>{severity}</option>)}
                </select>
              </div>
            </div>

            <div className="agentPanel">
              <div><span>Agent</span><strong>{selected.agent.displayName ?? selected.agent.phoneNumber}</strong></div>
              <div><span>Branch</span><strong>{selected.branchId ?? 'Unknown'}</strong></div>
              <div><span>Region</span><strong>{selected.region ?? 'Unknown'}</strong></div>
              <div><span>Language</span><strong>{selected.language}</strong></div>
            </div>

            <div className="messages">
              {selected.messages.map((message) => (
                <div key={message.id} className={`message ${message.direction.toLowerCase()}`}>
                  <div className="messageMeta">
                    <Badge>{message.direction}</Badge>
                    <span>{message.language} · {Math.round(message.confidence * 100)}% confidence</span>
                  </div>
                  <p className="original">{message.bodyOriginal}</p>
                  {message.bodyTranslated && <p className="translation">{message.bodyTranslated}</p>}
                </div>
              ))}
            </div>

            <div className="replyBox">
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply in English. Bonjou translates it for the agent." />
              <button onClick={sendReply}>Send translated reply</button>
            </div>
          </article>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
