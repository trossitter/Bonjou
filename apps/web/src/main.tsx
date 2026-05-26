import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const LANG_META: Record<string, { name: string }> = {
  ht: { name: 'Kreyòl' },
  fr: { name: 'Français' },
  es: { name: 'Español' },
  en: { name: 'English' },
  unknown: { name: 'Unknown' },
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

interface CityStats { total: number; open: number; today: number; }

function HaitiMap({ activeBranches, cityStats }: { activeBranches: string[]; cityStats: Record<string, CityStats> }) {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const activeCodes = new Set(activeBranches.map(b => b.slice(0, 3).toUpperCase()));

  return (
    <div className="haitiMapWrap">
      <div className="haitiMapLabel">
        <p className="eyebrow">Live field map</p>
        <p className="haitiMapSub">Click a city to see ticket counts</p>
      </div>
      <svg
        viewBox="0 0 390 270"
        className="haitiMapSvg"
        aria-label="Map of Haiti with active branch locations"
        onClick={(e) => { if (e.target === e.currentTarget) setSelectedCity(null); }}
      >
        <defs>
          <filter id="popShadow" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="rgba(16,24,40,0.14)" />
          </filter>
        </defs>
        {/* click-away background */}
        <rect x="0" y="0" width="390" height="270" fill="transparent" onClick={() => setSelectedCity(null)} />
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
          const selected = selectedCity === code;
          const stats = cityStats[code] ?? { total: 0, open: 0, today: 0 };
          // Popover above for southern cities, below for northern
          const popAbove = y > 120;
          const popY = popAbove ? y - 78 : y + 14;
          const popX = Math.max(4, Math.min(270, x - 58));
          const ticketWord = stats.total === 1 ? 'ticket' : 'tickets';
          return (
            <g key={code} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setSelectedCity(c => c === code ? null : code); }}>
              {active && <circle cx={x} cy={y} r="10" fill="#c9920a" opacity="0.18" className="cityPulse" />}
              {selected && <circle cx={x} cy={y} r="16" fill="#c9920a" opacity="0.14" />}
              <circle cx={x} cy={y} r={active || selected ? 5 : 3.5} fill={active || selected ? '#c9920a' : '#8fa3bf'} stroke="white" strokeWidth="1.5" />
              <text x={x} y={y - 9} textAnchor="middle" fontSize="9" fill={active ? '#7a5800' : '#607089'} fontWeight={active ? '700' : '400'}>{name}</text>
              {selected && (
                <g>
                  <rect x={popX} y={popY} width={118} height={62} rx={6} fill="white" stroke="#e6edf5" strokeWidth="1" filter="url(#popShadow)" />
                  <text x={popX + 10} y={popY + 17} fontSize="10" fontWeight="800" fill="#0d1b2a">{name}</text>
                  <text x={popX + 10} y={popY + 33} fontSize="9.5" fill="#607089">
                    {stats.open} open · {stats.total} {ticketWord}
                  </text>
                  <text x={popX + 10} y={popY + 50} fontSize="9.5" fontWeight="700" fill={stats.today > 0 ? '#c9920a' : '#8fa3bf'}>
                    {stats.today} today
                  </text>
                </g>
              )}
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
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [activeMetric, setActiveMetric] = useState<'open' | 'critical' | 'closed_today' | 'resolved' | 'patterns' | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'severity' | 'oldest'>('severity');

  const SEV_RANK: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

  const visibleTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const today = new Date().toDateString();
    const filtered = tickets.filter((ticket) => {
      const matchesStatus = statusFilter === 'ALL' || ticket.status === statusFilter;
      const matchesSeverity = severityFilter === 'ALL' || ticket.severity === severityFilter;
      const searchableText = [
        ticket.shortCode, ticket.title, ticket.summary, ticket.status, ticket.severity,
        ticket.category, ticket.issueKey, ticket.branchId, ticket.region, ticket.language,
        ticket.agent.displayName, ticket.agent.phoneNumber,
        ...ticket.messages.flatMap((m) => [m.bodyOriginal, m.bodyTranslated, m.language])
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);
      let matchesMetric = true;
      if (activeMetric === 'open') matchesMetric = ticket.status !== 'RESOLVED';
      else if (activeMetric === 'critical') matchesMetric = ticket.severity === 'CRITICAL' && ticket.status !== 'RESOLVED';
      else if (activeMetric === 'closed_today') matchesMetric = ticket.status === 'RESOLVED' && new Date(ticket.updatedAt).toDateString() === today;
      else if (activeMetric === 'resolved') matchesMetric = ticket.status === 'RESOLVED';
      return matchesStatus && matchesSeverity && matchesQuery && matchesMetric;
    });

    return [...filtered].sort((a, b) => {
      if (activeMetric === 'patterns') {
        const ik = a.issueKey.localeCompare(b.issueKey);
        if (ik !== 0) return ik;
        return SEV_RANK[a.severity] - SEV_RANK[b.severity];
      }
      if (sortBy === 'severity') {
        const sev = SEV_RANK[a.severity] - SEV_RANK[b.severity];
        if (sev !== 0) return sev;
      }
      if (sortBy === 'oldest') return +new Date(a.updatedAt) - +new Date(b.updatedAt);
      return +new Date(b.updatedAt) - +new Date(a.updatedAt);
    });
  }, [query, severityFilter, statusFilter, tickets, activeMetric, sortBy]);

  const selected = useMemo(
    () => visibleTickets.find((t) => t.id === selectedId) ?? visibleTickets[0],
    [visibleTickets, selectedId]
  );

  async function loadTickets() {
    const data = await fetch(`${API_BASE}/api/tickets`).then(r => r.json());
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
  }, []);

  async function updateTicket(partial: Partial<Pick<Ticket, 'status' | 'severity'>>) {
    if (!selected) return;
    const data = await fetch(`${API_BASE}/api/tickets/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial)
    }).then(r => r.json());
    setTickets((current) => current.map((t) => t.id === selected.id ? data.ticket : t));
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    await fetch(`${API_BASE}/api/tickets/${selected.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: reply })
    });
    setReply('');
    await loadTickets();
  }

  async function simulate() {
    const scenario = DEMO_SCENARIOS[scenarioIndex % DEMO_SCENARIOS.length];
    setScenarioIndex((i) => i + 1);
    await fetch(`${API_BASE}/dev/simulate-inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario)
    });
  }

  const workspaceRef = useRef<HTMLElement>(null);

  const activeBranches = tickets.map((t) => t.branchId).filter(Boolean) as string[];

  const cityStats = useMemo(() => {
    const today = new Date().toDateString();
    const stats: Record<string, CityStats> = {};
    for (const code of Object.keys(CITY_COORDS)) {
      const ct = tickets.filter(t => t.branchId?.slice(0, 3).toUpperCase() === code);
      stats[code] = {
        total: ct.length,
        open: ct.filter(t => t.status !== 'RESOLVED').length,
        today: ct.filter(t => new Date(t.updatedAt).toDateString() === today).length,
      };
    }
    return stats;
  }, [tickets]);

  const mttr = useMemo(() => {
    const resolved = tickets.filter(t => t.status === 'RESOLVED' && t.messages.length > 0);
    if (resolved.length === 0) return null;
    const totalMs = resolved.reduce((sum, t) => {
      const start = new Date(t.messages[0].createdAt).getTime();
      const end = new Date(t.updatedAt).getTime();
      return sum + Math.max(0, end - start);
    }, 0);
    return Math.round(totalMs / resolved.length / 60000);
  }, [tickets]);

  const closedToday = useMemo(() => {
    const today = new Date().toDateString();
    return tickets.filter(t => t.status === 'RESOLVED' && new Date(t.updatedAt).toDateString() === today).length;
  }, [tickets]);

  const mttrDisplay = mttr === null ? '—' : mttr < 60 ? `${mttr}m` : `${Math.floor(mttr / 60)}h ${mttr % 60}m`;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Designed by Thalia</p>
          <h1>Bonjou</h1>
          <p>WhatsApp-native field ops inbox for Haiti</p>
        </div>
        <button className="waButton" onClick={simulate}>
          <WhatsAppIcon size={16} />New field report
        </button>
      </header>

      <>
          <section className="metrics">
            {([
              { key: 'open'         as const, value: tickets.filter(t => t.status !== 'RESOLVED').length,                              label: 'Open tickets' },
              { key: 'critical'     as const, value: tickets.filter(t => t.severity === 'CRITICAL' && t.status !== 'RESOLVED').length,  label: 'Critical · open' },
              { key: 'resolved'     as const, value: mttrDisplay,                                                                       label: 'Mean time to resolve' },
              { key: 'closed_today' as const, value: closedToday,                                                                       label: 'Closed today' },
              { key: 'patterns'     as const, value: new Set(tickets.map(t => t.issueKey)).size,                                        label: 'Issue patterns' },
            ]).map(({ key, value, label }) => {
              const isActive = activeMetric === key;
              function handleClick() {
                const next = isActive ? null : key;
                setActiveMetric(next);
                if (next !== null) workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
              return (
                <div
                  key={label}
                  className={`metricCard${isActive ? ' metricActive' : ''}`}
                  onClick={handleClick}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  onKeyDown={e => e.key === 'Enter' && handleClick()}
                >
                  <strong>{value}</strong>
                  <span>{label}</span>
                  {isActive && <small className="metricFilterHint">active · click to clear</small>}
                </div>
              );
            })}
          </section>

          <HaitiMap activeBranches={activeBranches} cityStats={cityStats} />

          <section className="workspace" ref={workspaceRef}>
            <aside className="ticketList">
              <div className="ticketFilters">
                <input
                  aria-label="Search tickets"
                  placeholder="Search tickets"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <div className="filterRow">
                  <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as Status | 'ALL')}>
                    <option value="ALL">All status</option>
                    {['OPEN', 'IN_PROGRESS', 'WAITING_ON_AGENT', 'RESOLVED'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select aria-label="Filter by severity" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as Severity | 'ALL')}>
                    <option value="ALL">All severity</option>
                    {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="sortRow">
                  <span>Sort by</span>
                  <div className="sortPills">
                    {(['severity', 'newest', 'oldest'] as const).map((val) => (
                      <button
                        key={val}
                        className={`sortPill${sortBy === val ? ' active' : ''}`}
                        onClick={() => setSortBy(val)}
                      >{{ severity: 'Severity', newest: 'Newest', oldest: 'Oldest' }[val]}</button>
                    ))}
                  </div>
                </div>
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
                      <span className="waBadgeSmall"><WhatsAppIcon size={10} /></span>
                      <span className="langChip">{lang.name}</span>
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
                    <button
                      className={selected.status === 'RESOLVED' ? 'reopenBtn' : 'closeBtn'}
                      onClick={() => updateTicket({ status: selected.status === 'RESOLVED' ? 'OPEN' : 'RESOLVED' })}
                    >
                      {selected.status === 'RESOLVED' ? 'Reopen' : 'Close ticket'}
                    </button>
                    <select value={selected.status} onChange={(e) => updateTicket({ status: e.target.value as Status })}>
                      {['OPEN', 'IN_PROGRESS', 'WAITING_ON_AGENT', 'RESOLVED'].map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <div className="severityPicker">
                      <label>AI classified · confirm or adjust</label>
                      <div className="severityPills">
                        {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as Severity[]).map((s) => (
                          <button
                            key={s}
                            className={`sevPill ${s.toLowerCase()}${selected.severity === s ? ' active' : ''}`}
                            onClick={() => updateTicket({ severity: s })}
                            aria-pressed={selected.severity === s}
                          >{s}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="agentPanel">
                  <div><span>Agent</span><strong>{selected.agent.displayName ?? selected.agent.phoneNumber}</strong></div>
                  <div><span>Branch</span><strong>{selected.branchId ?? 'Unknown'}</strong></div>
                  <div><span>Region</span><strong>{selected.region ?? 'Unknown'}</strong></div>
                  <div>
                    <span>Language</span>
                    <span className="langChip langChipLg">{LANG_META[selected.language]?.name ?? selected.language}</span>
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
                        <span className="langChip">{LANG_META[message.language]?.name ?? message.language}</span>
                        <span>{Math.round(message.confidence * 100)}% confidence</span>
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
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
