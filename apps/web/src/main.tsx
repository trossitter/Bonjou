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

const LANG_META: Record<string, { flag: string; name: string }> = {
  ht: { flag: '🇭🇹', name: 'Kreyòl' },
  fr: { flag: '🇫🇷', name: 'Français' },
  es: { flag: '🇪🇸', name: 'Español' },
  en: { flag: '🇺🇸', name: 'English' },
  unknown: { flag: '🌐', name: 'Unknown' },
};

const DEMO_SCENARIOS = [
  {
    from: '50937100001',
    text: 'Sistèm nan pa aksepte pari yo depi yon è. Kliyan yo ret la ap tann. Match la kòmanse déjà.',
    name: 'Nadia Jean-Baptiste',
    branchId: 'PAP-003',
    region: 'Port-au-Prince',
    preferredLanguage: 'ht' as const,
  },
  {
    from: '50937100002',
    text: 'Kliyan ki genyen pa ka retire kòb yo. Sistèm di "en attente" men lajan an pa vini menm apre 2 èdtan.',
    name: 'Roselène Augustin',
    branchId: 'CAY-007',
    region: 'Les Cayes',
    preferredLanguage: 'ht' as const,
  },
  {
    from: '50937100003',
    // deliberate misspelling: "completement" missing accent, "conection" vs "connexion"
    text: 'Système completement hors ligne pendant le match Brésil-Argentine. Imposible de prendre des paris. Les clients sont furieux.',
    name: 'Bernard Élie',
    branchId: 'CAP-012',
    region: 'Cap-Haïtien',
    preferredLanguage: 'fr' as const,
  },
  {
    from: '50937100004',
    text: 'Las cuotas no se actualizan desde hace 20 minutos. Los clientes no quieren apostar con cuotas viejas del partido anterior.',
    name: 'Carlos Mejía',
    branchId: 'JAC-021',
    region: 'Jacmel',
    preferredLanguage: 'es' as const,
  },
  {
    from: '50937100005',
    // deliberate misspelling: "defwa" (de fwa), "sel" (sèl)
    text: 'Sistèm dedwi lajan defwa pou yon sel pari. Kliyan an pedi 1500 goud. Li fache anpil epi li vle ranbousman.',
    name: 'Jean-Pierre Étienne',
    branchId: 'GON-005',
    region: 'Gonaïves',
    preferredLanguage: 'ht' as const,
  },
  {
    from: '50937100006',
    // deliberate misspelling: "supendu" vs "suspendu", "Pluiseurs" vs "Plusieurs"
    text: 'Compte client supendu sans raison pendant la demi-finale. Il avait 3000 gourdes de gains. Pluiseurs clients dans le même cas ce soir.',
    name: 'Marie-Flore Desir',
    branchId: 'PAP-017',
    region: 'Port-au-Prince',
    preferredLanguage: 'fr' as const,
  },
  {
    from: '50937100007',
    // deliberate misspelling: "Apliasyon" vs "Aplikasyon"
    text: 'Apliasyon an montre move rezilta pou match lan. Kliyan ki te genyen ap mande lajan yo men sistèm di yo pèdi.',
    name: 'Claudette Morency',
    branchId: 'CAP-008',
    region: 'Cap-Haïtien',
    preferredLanguage: 'ht' as const,
  },
];

const CITY_COORDS: Record<string, { x: number; y: number; name: string }> = {
  PAP: { x: 278, y: 190, name: 'Port-au-Prince' },
  CAP: { x: 296, y: 52, name: 'Cap-Haïtien' },
  GON: { x: 233, y: 82, name: 'Gonaïves' },
  CAY: { x: 100, y: 232, name: 'Les Cayes' },
  JAC: { x: 252, y: 218, name: 'Jacmel' },
  PDP: { x: 212, y: 32, name: 'Port-de-Paix' },
};

function WhatsAppIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function HaitiMap({ activeBranches }: { activeBranches: string[] }) {
  const activeCodes = new Set(activeBranches.map(b => b.slice(0, 3).toUpperCase()));
  return (
    <div className="haitiMapWrap">
      <div className="haitiMapLabel">
        <p className="eyebrow">Live field map</p>
        <p className="haitiMapSub">Active branches lighting up as reports come in</p>
      </div>
      <svg viewBox="0 0 390 270" className="haitiMapSvg" aria-label="Map of Haiti with active branch locations">
        {/* Haiti outline */}
        <path
          d="M 142 42 L 197 22 L 248 38 L 296 40 L 358 68 L 370 128 L 354 188 L 320 220 L 262 228 L 205 225 L 148 238 L 122 248 L 22 222 L 68 194 L 120 158 L 110 110 L 130 70 Z"
          fill="#e8eef8" stroke="#b8c8e0" strokeWidth="1.5"
        />
        {/* La Gonâve island */}
        <path
          d="M 157 174 Q 178 162 207 168 Q 222 174 207 182 Q 178 190 157 174 Z"
          fill="#e8eef8" stroke="#b8c8e0" strokeWidth="1"
        />
        {/* City dots */}
        {Object.entries(CITY_COORDS).map(([code, { x, y, name }]) => {
          const active = activeCodes.has(code);
          return (
            <g key={code}>
              {active && <circle cx={x} cy={y} r="10" fill="#c9920a" opacity="0.18" className="cityPulse" />}
              <circle cx={x} cy={y} r={active ? 5 : 3.5} fill={active ? '#c9920a' : '#8fa3bf'} stroke="white" strokeWidth="1.5" />
              <text x={x} y={y - 9} textAnchor="middle" fontSize="9" fill={active ? '#7a5800' : '#607089'} fontWeight={active ? '700' : '400'}>{name}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

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
  const [authMessage, setAuthMessage] = useState('');
  const [scenarioIndex, setScenarioIndex] = useState(0);

  const visibleTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesStatus = statusFilter === 'ALL' || ticket.status === statusFilter;
      const matchesSeverity = severityFilter === 'ALL' || ticket.severity === severityFilter;
      const searchableText = [
        ticket.shortCode, ticket.title, ticket.summary, ticket.status, ticket.severity,
        ticket.category, ticket.issueKey, ticket.branchId, ticket.region, ticket.language,
        ticket.agent.displayName, ticket.agent.phoneNumber,
        ...ticket.messages.flatMap((m) => [m.bodyOriginal, m.bodyTranslated, m.language])
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);
      return matchesStatus && matchesSeverity && matchesQuery;
    });
  }, [query, severityFilter, statusFilter, tickets]);

  const selected = useMemo(
    () => visibleTickets.find((t) => t.id === selectedId) ?? visibleTickets[0],
    [visibleTickets, selectedId]
  );

  function authHeaders(): HeadersInit {
    return accessToken ? { 'x-dashboard-access-token': accessToken } : {};
  }

  function handleUnauthorized(response: Response) {
    if (response.status === 401) {
      setAuthRequired(true);
      setAuthMessage(accessToken.trim()
        ? 'That password did not unlock Bonjou. Check the value shared for this pilot.'
        : 'Enter the Bonjou demo password shared for this pilot.');
      return true;
    }
    return false;
  }

  async function loadTickets() {
    const response = await fetch(`${API_BASE}/api/tickets`, { headers: authHeaders() });
    if (handleUnauthorized(response)) return;
    const data = await response.json();
    setAuthRequired(false);
    setAuthMessage('');
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
    setTickets((current) => current.map((t) => t.id === selected.id ? data.ticket : t));
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
    const scenario = DEMO_SCENARIOS[scenarioIndex % DEMO_SCENARIOS.length];
    setScenarioIndex((i) => i + 1);
    const response = await fetch(`${API_BASE}/dev/simulate-inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(scenario)
    });
    if (handleUnauthorized(response)) return;
  }

  function saveAccessToken(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = accessTokenInput.trim();
    if (!trimmed) {
      localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      setAccessToken('');
      setAuthRequired(true);
      setAuthMessage('Enter the Bonjou demo password shared for this pilot.');
      return;
    }
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, trimmed);
    setAccessToken(trimmed);
    setAuthMessage('Checking Bonjou demo password...');
  }

  const activeBranches = tickets.map((t) => t.branchId).filter(Boolean) as string[];

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Designed by Thalia</p>
          <h1>Bonjou</h1>
          <p>WhatsApp-native field ops inbox for Haiti</p>
        </div>
        <button className="waButton" onClick={simulate} disabled={authRequired}>
          {authRequired ? 'Unlock Bonjou first' : <><WhatsAppIcon size={16} />New field report</>}
        </button>
      </header>
      <div className="motif" aria-hidden="true" />

      {authRequired && (
        <form className="accessGate" onSubmit={saveAccessToken}>
          <div className="accessGateCopy">
            <label htmlFor="dashboardAccessToken">Bonjou demo password</label>
            <p id="dashboardAccessHelp">Use the password shared by Thalia for this pilot.</p>
            {authMessage && <p className="accessMessage">{authMessage}</p>}
          </div>
          <input
            id="dashboardAccessToken"
            value={accessTokenInput}
            onChange={(event) => setAccessTokenInput(event.target.value)}
            type="password"
            autoComplete="off"
            aria-describedby="dashboardAccessHelp"
            placeholder="Paste Bonjou demo password"
          />
          <button type="submit">Open Bonjou</button>
        </form>
      )}

      {!authRequired && (
        <>
          <section className="metrics">
            <div><strong>{tickets.filter(t => t.status !== 'RESOLVED').length}</strong><span>Open</span></div>
            <div><strong>{tickets.filter(t => t.severity === 'CRITICAL').length}</strong><span>Critical</span></div>
            <div><strong>{new Set(tickets.map(t => t.issueKey)).size}</strong><span>Issue patterns</span></div>
          </section>

          <HaitiMap activeBranches={activeBranches} />

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
                  {['OPEN', 'IN_PROGRESS', 'WAITING_ON_AGENT', 'RESOLVED'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select aria-label="Filter by severity" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as Severity | 'ALL')}>
                  <option value="ALL">All severity</option>
                  {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {visibleTickets.map((ticket) => {
                const lang = LANG_META[ticket.language] ?? LANG_META.unknown;
                return (
                  <button key={ticket.id} onClick={() => setSelectedId(ticket.id)} className={ticket.id === selected?.id ? 'active ticketCard' : 'ticketCard'}>
                    <span className="row">
                      <strong>{ticket.shortCode}</strong>
                      <Badge tone={ticket.severity.toLowerCase()}>{ticket.severity}</Badge>
                    </span>
                    <span>{ticket.title}</span>
                    <span className="ticketCardMeta">
                      <small>{ticket.agent.displayName ?? ticket.agent.phoneNumber} · {ticket.branchId ?? 'No branch'}</small>
                      <span className="waBadgeSmall"><WhatsAppIcon size={10} /> {lang.flag} {lang.name}</span>
                    </span>
                  </button>
                );
              })}
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
                      {['OPEN', 'IN_PROGRESS', 'WAITING_ON_AGENT', 'RESOLVED'].map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <select value={selected.severity} onChange={(e) => updateTicket({ severity: e.target.value as Severity })}>
                      {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="agentPanel">
                  <div><span>Agent</span><strong>{selected.agent.displayName ?? selected.agent.phoneNumber}</strong></div>
                  <div><span>Branch</span><strong>{selected.branchId ?? 'Unknown'}</strong></div>
                  <div><span>Region</span><strong>{selected.region ?? 'Unknown'}</strong></div>
                  <div>
                    <span>Language</span>
                    <strong>{LANG_META[selected.language]?.flag} {LANG_META[selected.language]?.name ?? selected.language}</strong>
                  </div>
                </div>

                <div className="messages">
                  {selected.messages.map((message) => (
                    <div key={message.id} className={`message ${message.direction.toLowerCase()}`}>
                      <div className="messageMeta">
                        <Badge>{message.direction}</Badge>
                        {message.direction === 'INBOUND' && (
                          <span className="waBadgeMsg"><WhatsAppIcon size={11} /> via WhatsApp</span>
                        )}
                        <span>{LANG_META[message.language]?.flag ?? ''} {Math.round(message.confidence * 100)}% confidence</span>
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
        </>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
