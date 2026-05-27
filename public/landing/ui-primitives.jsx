// ui-primitives.jsx — shared building blocks (chrome, mock UI helpers, icons)

// Hook responsivo reutilizável — exportado para todos os arquivos de seção
function useBreakpoint(bp) {
  bp = bp || 768;
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth < bp : false
  );
  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < bp);
    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, [bp]);
  return isMobile;
}

function SectionHead({ num, label, title, lede, align = "split" }) {
  const isMobile = useBreakpoint();
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: (align === "split" && !isMobile) ? "minmax(180px, 1fr) 2.4fr" : "1fr",
      gap: isMobile ? 12 : 60, alignItems: "start", marginBottom: isMobile ? 40 : 56
    }}>
      <div>
        <div className="section-num">{num} · {label}</div>
      </div>
      <div>
        <h2 style={{ fontSize: "clamp(34px, 3.8vw, 54px)", lineHeight: 1.08, maxWidth: 820 }}>
          {title}
        </h2>
        {lede && (
          <p className="muted" style={{
            marginTop: 26, maxWidth: 720, fontSize: 17.5,
            lineHeight: 1.65, fontWeight: 300
          }}>
            {lede}
          </p>
        )}
      </div>
    </div>
  );
}

// Iconografia — linha (stroke) 1.5px, viewBox 24×24. Nunca emoji.
function Icon({ name, size = 18, stroke = 1.5, color = "currentColor" }) {
  const props = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: color, strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round"
  };
  switch (name) {
    case "box":
      return <svg {...props}><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>;
    case "syringe":
      return <svg {...props}><path d="M18 2l4 4"/><path d="M16 4l4 4"/><path d="M14 6l4 4-8 8H6v-4l8-8z"/><path d="M5 19l-2 2"/></svg>;
    case "chart":
      return <svg {...props}><path d="M3 3v18h18"/><path d="M7 15l4-6 3 4 5-8"/></svg>;
    case "doc":
      return <svg {...props}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h6"/></svg>;
    case "phone":
      return <svg {...props}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"/></svg>;
    case "shield":
      return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>;
    case "lock":
      return <svg {...props}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
    case "eye":
      return <svg {...props}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    case "users":
      return <svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "user":
      return <svg {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case "calendar":
      return <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
    case "alert":
      return <svg {...props}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>;
    case "arrow":
      return <svg {...props}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case "check":
      return <svg {...props}><path d="M20 6 9 17l-5-5"/></svg>;
    case "search":
      return <svg {...props}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
    case "filter":
      return <svg {...props}><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>;
    case "logo-m":
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M3 21V5l9 12 9-12v16" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>;
    default: return null;
  }
}

// Mock de aplicação — sidebar oculta em mobile para maximizar área de conteúdo
function AppChrome({ title, role, children, height }) {
  const isMobile = useBreakpoint();
  return (
    <div style={{
      borderRadius: 14, overflow: "hidden",
      border: "1px solid var(--line-2)",
      background: "#0f0d0a",
      boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,162,74,0.08)"
    }}>
      {/* title bar */}
      <div style={{
        height: 38, background: "linear-gradient(180deg, #1a1611, #14110d)",
        borderBottom: "1px solid var(--line)",
        display: "flex", alignItems: "center", padding: "0 14px", gap: 10
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["#3a342a", "#3a342a", "#3a342a"].map((c, i) => (
            <span key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c, border: "1px solid rgba(255,255,255,0.05)" }}></span>
          ))}
        </div>
        <div style={{
          flex: 1, textAlign: "center", fontFamily: "var(--mono)", fontSize: 11,
          color: "var(--ink-3)", letterSpacing: "0.1em"
        }}>
          {title}
        </div>
        <div style={{ width: 42, textAlign: "right", fontSize: 10, color: "var(--gold)", fontFamily: "var(--mono)", letterSpacing: "0.1em" }}>
          {role}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "180px 1fr", minHeight: height || 460 }}>
        {!isMobile && <AppSidebar />}
        <div style={{ background: "var(--bg)", padding: isMobile ? 16 : 24, overflow: "hidden" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function AppSidebar({ active = "Visão geral" }) {
  const items = [
    ["Visão geral", "chart"],
    ["Inventário", "box"],
    ["Aplicações", "syringe"],
    ["Investimentos", "doc"],
    ["Relatórios", "chart"],   // fix: era "doc", igual a Investimentos
    ["Consultor", "phone"]
  ];
  return (
    <div style={{
      background: "linear-gradient(180deg, #14110d, #0f0d0a)",
      borderRight: "1px solid var(--line)",
      padding: "20px 14px", display: "flex", flexDirection: "column", gap: 4
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 22px"
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6, border: "1px solid var(--gold)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "var(--gold)", fontFamily: "var(--serif)", fontSize: 14
        }}>M</div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 14 }}>Curva <em style={{ color: "var(--gold-2)", fontWeight: 300 }}>Mestra</em></div>
      </div>
      {items.map(([label, icon], i) => {
        const isActive = label === active;
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", borderRadius: 6,
            background: isActive ? "rgba(201,162,74,0.10)" : "transparent",
            color: isActive ? "var(--gold-2)" : "var(--ink-3)",
            fontSize: 12.5, letterSpacing: "0.01em"
          }}>
            <Icon name={icon} size={14} stroke={1.4} />
            <span>{label}</span>
            {isActive && <span style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: "50%", background: "var(--gold)" }}></span>}
          </div>
        );
      })}
      {/* fix: marginTop duplicado removido — "auto" empurra o rodapé para o fundo */}
      <div style={{ marginTop: "auto", padding: "12px 10px", borderTop: "1px solid var(--line)" }}>
        <div style={{ fontSize: 10.5, color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.1em" }}>CLÍNICA ATIVA</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 4 }}>Dra. Helena Vidal</div>
      </div>
    </div>
  );
}

// Card primitivo
function Card({ children, style, padding = 22, hover = false }) {
  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(28,24,18,0.45), rgba(20,17,13,0.25))",
      border: "1px solid var(--line)",
      borderRadius: 12,
      padding,
      transition: "border-color .25s ease, transform .25s ease",
      ...style
    }} onMouseEnter={hover ? (e) => e.currentTarget.style.borderColor = "var(--line-2)" : undefined}
       onMouseLeave={hover ? (e) => e.currentTarget.style.borderColor = "var(--line)" : undefined}>
      {children}
    </div>
  );
}

// Stat — KPI pequeno
function Stat({ value, label, trend, accent }) {
  return (
    <div>
      <div style={{
        fontFamily: "var(--serif)", fontSize: 32, lineHeight: 1, fontWeight: 400,
        color: accent ? "var(--gold-2)" : "var(--ink)"
      }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--ink-3)", letterSpacing: "0.05em", fontFamily: "var(--mono)", textTransform: "uppercase" }}>{label}</div>
      {trend && <div style={{ marginTop: 6, fontSize: 11, color: trend.startsWith("+") ? "#4ade80" : "var(--ink-3)" }}>{trend}</div>}
    </div>
  );
}

// Gráfico de barras (SVG estático)
function MiniBars({ values, width = 280, height = 70, color = "var(--gold)" }) {
  const max = Math.max(...values);
  const bw = width / values.length;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {values.map((v, i) => {
        const h = (v / max) * (height - 8);
        return <rect key={i} x={i * bw + 2} y={height - h} width={bw - 4} height={h}
                     fill={color} opacity={0.3 + (v / max) * 0.7} rx="1.5"/>;
      })}
    </svg>
  );
}

// Donut chart — mix de produtos
function Donut({ segments, size = 110 }) {
  const total = segments.reduce((s, x) => s + x.v, 0);
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(243,236,224,0.06)" strokeWidth="10"/>
      {segments.map((s, i) => {
        const len = (s.v / total) * c;
        const el = <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
                           stroke={s.color} strokeWidth="10"
                           strokeDasharray={`${len} ${c}`}
                           strokeDashoffset={-off}
                           transform={`rotate(-90 ${size/2} ${size/2})`}/>;
        off += len;
        return el;
      })}
      <text x={size/2} y={size/2 - 2} textAnchor="middle"
            fill="var(--ink)" style={{ font: '500 14px var(--serif)' }}>{segments.length}</text>
      <text x={size/2} y={size/2 + 12} textAnchor="middle"
            fill="var(--ink-3)" style={{ font: '500 8px var(--mono)', letterSpacing: '0.15em' }}>LINHAS</text>
    </svg>
  );
}

Object.assign(window, { useBreakpoint, SectionHead, Icon, AppChrome, AppSidebar, Card, Stat, MiniBars, Donut });
