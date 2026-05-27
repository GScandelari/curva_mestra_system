// sections-hero.jsx — Nav + Hero with dashboard preview

const { useState, useEffect } = React;

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const scrollTo = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <nav className={"nav " + (scrolled ? "scrolled" : "")}>
      <a href="#top" className="nav-logo" onClick={scrollTo("top")}>
        <img src="assets/logo.png" alt="Curva Mestra" />
        <span className="wordmark">Curva <em>Mestra</em></span>
      </a>
      <div className="nav-links">
        <a href="#sistema" onClick={scrollTo("sistema")}>O sistema</a>
        <a href="#especialista" onClick={scrollTo("especialista")}>Para o especialista</a>
        <a href="#consultor" onClick={scrollTo("consultor")}>Para o consultor</a>
        <a href="#seguranca" onClick={scrollTo("seguranca")}>Segurança</a>
        <a href="#faq" onClick={scrollTo("faq")}>FAQ</a>
      </div>
      <div className="nav-cta">
        <span className="dim" style={{ fontSize: 12.5, fontFamily: "var(--mono)" }}>Acesso restrito</span>
        <a href="https://curvamestra.com.br/login" className="btn btn-primary" style={{ padding: "11px 18px", fontSize: 13.5 }}>
          Acessar <span className="arrow">→</span>
        </a>
      </div>
    </nav>
  );
}

const HEADLINES = {
  inventario: {
    eyebrow: "Sistema de gestão · Harmonização orofacial e corporal",
    h1: (
      <>
        Inventário, aplicações e<br />
        investimentos da sua clínica HOF —<br />
        <span className="serif-it">sob a mesma curva.</span>
      </>
    ),
    sub: "Curva Mestra é o sistema de gestão operacional que conecta o especialista em harmonização e o consultor Rennova em uma única superfície — com visibilidade real de estoque, aplicações registradas por produto e retorno por linha. Zero dado de paciente, por desenho."
  },
  curva: {
    eyebrow: "Exclusivo · Rede de especialistas Rennova",
    h1: (
      <>
        A <span className="serif-it">curva mestra</span> entre o<br />
        especialista e o consultor.
      </>
    ),
    sub: "Um sistema desenhado para a rotina da clínica de harmonização orofacial e corporal — inventário rastreável, procedimentos registrados, investimentos auditáveis. Para o consultor Rennova: a visão pareada da operação do cliente, em tempo real."
  },
  precisao: {
    eyebrow: "Sistema de gestão · Curva Mestra",
    h1: (
      <>
        Precisão clínica.<br />
        <span className="underline-gold">Visão gerencial.</span><br />
        <span className="serif-it">Mesmo sistema.</span>
      </>
    ),
    sub: "Da entrada do produto na clínica até a baixa por aplicação, Curva Mestra traz inventário, custos e relacionamento com o consultor Rennova para o mesmo painel — pensado para a complexidade da harmonização orofacial e corporal, sem nunca tocar em dado de paciente."
  }
};

function Hero({ headlineVariant }) {
  const isMobile = useBreakpoint();
  const data = HEADLINES[headlineVariant] || HEADLINES.inventario;
  return (
    <header id="top" style={{ position: "relative", paddingTop: isMobile ? 100 : 130, paddingBottom: 60, overflow: "hidden" }}>
      <HeroBackdrop />
      <div className="wrap" style={{ position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: 980 }}>
          <div className="eyebrow" style={{ marginBottom: 26 }}>
            <span className="dot"></span>{data.eyebrow}
          </div>
          <h1 style={{ fontSize: "clamp(40px, 5.6vw, 80px)", letterSpacing: "-0.03em", fontWeight: 400, lineHeight: 1.02 }}>
            {data.h1}
          </h1>
          <p style={{
            marginTop: 32, fontSize: "clamp(16px, 1.25vw, 20px)", maxWidth: 720,
            lineHeight: 1.6, color: "var(--ink-2)", fontWeight: 300
          }}>
            {data.sub}
          </p>
          <div style={{ display: "flex", gap: 14, marginTop: 36, flexWrap: "wrap", alignItems: "center" }}>
            <a href="#acesso" onClick={(e) => { e.preventDefault(); document.getElementById("acesso")?.scrollIntoView({ behavior: "smooth" }); }}
               className="btn btn-primary btn-lg">
              Solicitar acesso <span className="arrow">→</span>
            </a>
            <a href="#sistema" onClick={(e) => { e.preventDefault(); document.getElementById("sistema")?.scrollIntoView({ behavior: "smooth" }); }}
               className="btn btn-ghost btn-lg">
              Conhecer o sistema
            </a>
          </div>
          <p style={{ marginTop: 18, fontSize: 12.5, color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.05em" }}>
            Distribuição fechada · Disponível apenas para a rede de especialistas e consultores Rennova
          </p>
        </div>

        {/* Dashboard preview */}
        <div style={{ marginTop: 88, position: "relative" }}>
          <HeroDashboard />
        </div>

        {/* Feature strip abaixo do dashboard */}
        <div style={{
          marginTop: 64,
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          borderTop: "1px solid var(--line)", paddingTop: 28, gap: 0
        }}>
          {[
            ["Inventário", "Lote, vencimento, valor"],
            ["Aplicações", "Produto, dose, área, custo"],
            ["Investimentos", "Histórico e projeção"],
            ["Linha direta", "Consultor Rennova"]
          ].map(([t, d], i) => (
            <div key={i} style={{
              padding: isMobile ? "14px 0" : "8px 22px 8px 0",
              borderLeft: (!isMobile && i > 0) ? "1px solid var(--line)" : "none",
              borderTop: (isMobile && i > 0) ? "1px solid var(--line)" : "none",
              paddingLeft: (!isMobile && i > 0) ? 26 : 0
            }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--gold)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                Módulo 0{i + 1}
              </div>
              <div style={{ marginTop: 8, fontFamily: "var(--serif)", fontSize: 22, lineHeight: 1.1 }}>{t}</div>
              <div style={{ marginTop: 4, fontSize: 13, color: "var(--ink-3)" }}>{d}</div>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

function HeroBackdrop() {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }}>
      <div style={{
        position: "absolute", right: "-12%", top: "-8%", width: "62vw", height: "62vw",
        maxWidth: 900, maxHeight: 900,
        background: "radial-gradient(circle at center, rgba(201,162,74,0.14), rgba(201,162,74,0.03) 40%, transparent 65%)",
        filter: "blur(20px)"
      }}></div>
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(243,236,224,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(243,236,224,0.025) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
        maskImage: "radial-gradient(ellipse at 70% 30%, #000, transparent 75%)"
      }}></div>
    </div>
  );
}

// HERO DASHBOARD — preview composto da visão especialista + consultor
function HeroDashboard() {
  const isMobile = useBreakpoint();

  const lots = [
    { code: "HLX-2391", product: "Hyalux Ultra 1ml", qty: 12, exp: "08/26", status: "ok" },
    { code: "RDS-1182", product: "Radiesse 1.5ml", qty: 5, exp: "11/26", status: "ok" },
    { code: "BTX-0427", product: "Toxina · 100u", qty: 3, exp: "06/26", status: "warn" },
    { code: "HLX-2402", product: "Hyalux Lift 1ml", qty: 18, exp: "01/27", status: "ok" },
    { code: "BTX-0428", product: "Toxina · 200u", qty: 1, exp: "06/26", status: "warn" }
  ];

  return (
    <div style={{
      position: "relative",
      transform: isMobile ? "none" : "perspective(2400px) rotateX(2deg)",
      transformOrigin: "center top"
    }}>
      <AppChrome title="curvamestra.app / dashboard" role="ESPECIALISTA HOF" height={520}>
        {/* Top row: título + filtros */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Visão geral · Maio 2026
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 22, marginTop: 4 }}>Bem-vinda, Dra. Helena</div>
          </div>
          {!isMobile && (
            <div style={{ display: "flex", gap: 8 }}>
              <Chip>Últimos 30 dias</Chip>
              <Chip icon="filter">Filtros</Chip>
            </div>
          )}
        </div>

        {/* KPI row */}
        <div style={{
          display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 14, marginBottom: 18
        }}>
          {[
            { v: "R$ 28.460", l: "Em estoque (custo)", t: "+R$ 4.120 vs abril" },
            { v: "184", l: "Aplicações · 30d", t: "+22 vs período anterior", a: true },
            { v: "R$ 154", l: "Custo médio / aplicação", t: "−R$ 8 vs abril" },
            { v: "2", l: "Lotes vencendo", t: "≤ 30 dias", warn: true }
          ].map((k, i) => (
            <Card key={i} padding={18}>
              <div style={{ fontFamily: "var(--serif)", fontSize: 24, lineHeight: 1, color: k.a ? "var(--gold-2)" : "var(--ink)" }}>{k.v}</div>
              <div style={{ marginTop: 8, fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.08em", fontFamily: "var(--mono)", textTransform: "uppercase" }}>{k.l}</div>
              <div style={{ marginTop: 4, fontSize: 10.5, color: k.warn ? "#f59e0b" : "#4ade80" }}>{k.t}</div>
            </Card>
          ))}
        </div>

        {/* Bottom row: tabela de inventário + gráfico */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr", gap: 14 }}>
          <Card padding={0}>
            <div style={{ padding: "14px 18px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)" }}>
              <div style={{ fontSize: 12, fontFamily: "var(--mono)", letterSpacing: "0.1em", color: "var(--ink-2)", textTransform: "uppercase" }}>Inventário · top lotes</div>
              <a style={{ fontSize: 11, color: "var(--gold)", fontFamily: "var(--mono)", letterSpacing: "0.08em" }}>Ver todos →</a>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  <th style={{ padding: "10px 18px", fontWeight: 400 }}>Lote</th>
                  <th style={{ padding: "10px 8px", fontWeight: 400 }}>Produto</th>
                  <th style={{ padding: "10px 8px", fontWeight: 400, textAlign: "right" }}>Qtd</th>
                  <th style={{ padding: "10px 18px", fontWeight: 400, textAlign: "right" }}>Validade</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((l, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: "11px 18px", color: "var(--ink-2)", fontFamily: "var(--mono)" }}>{l.code}</td>
                    <td style={{ padding: "11px 8px", color: "var(--ink)" }}>{l.product}</td>
                    <td style={{ padding: "11px 8px", color: "var(--ink-2)", textAlign: "right", fontFamily: "var(--mono)" }}>{l.qty}</td>
                    <td style={{ padding: "11px 18px", textAlign: "right" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "2px 8px", borderRadius: 4,
                        background: l.status === "warn" ? "rgba(245,158,11,0.12)" : "rgba(74,222,128,0.10)",
                        color: l.status === "warn" ? "#f59e0b" : "#4ade80",
                        fontFamily: "var(--mono)", fontSize: 10.5
                      }}>
                        {l.exp}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Chart card */}
          <Card padding={18}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.1em", color: "var(--ink-3)", textTransform: "uppercase" }}>Aplicações / semana</div>
              <div style={{ fontSize: 11, color: "var(--gold-2)" }}>+18%</div>
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 28, marginTop: 8 }}>184</div>
            <div style={{ marginTop: 14 }}>
              <MiniBars values={[18, 26, 22, 31, 28, 24, 35]} width={220} height={64} />
            </div>
            <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--ink-3)", letterSpacing: "0.06em" }}>
              <span>S1</span><span>S2</span><span>S3</span><span>S4</span><span>S5</span><span>S6</span><span>S7</span>
            </div>
          </Card>
        </div>
      </AppChrome>

      {/* Balão flutuante — mensagem do consultor */}
      <div style={{
        position: isMobile ? "relative" : "absolute",
        right: isMobile ? "auto" : "-3%",
        top: isMobile ? "auto" : "32%",
        marginTop: isMobile ? 16 : 0,
        width: isMobile ? "100%" : 260,
        padding: "16px 18px",
        borderRadius: 12,
        background: "linear-gradient(180deg, #1c1812, #14110d)",
        border: "1px solid var(--gold-3)",
        boxShadow: "0 18px 48px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,162,74,0.18), 0 0 30px var(--gold-glow)",
        animation: isMobile ? "none" : "float 6s ease-in-out infinite"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{
            width: 22, height: 22, borderRadius: "50%", background: "var(--gold)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: "#0a0908", fontFamily: "var(--serif)", fontSize: 11, fontWeight: 600
          }}>CR</div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 500 }}>Carlos Reis</div>
            <div style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>Consultor Rennova</div>
          </div>
        </div>
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-2)" }}>
          Vi que dois lotes vencem em 30 dias. Posso te apoiar com um cronograma de uso até lá?
        </div>
      </div>
      {/* @keyframes float definido no CSS global do HTML */}
    </div>
  );
}

function Chip({ children, icon }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "6px 12px", borderRadius: 6,
      border: "1px solid var(--line-2)", color: "var(--ink-2)",
      fontSize: 11.5, fontFamily: "var(--mono)", letterSpacing: "0.04em"
    }}>
      {icon && <Icon name={icon} size={11} stroke={1.6} />}
      {children}
    </div>
  );
}

function Marquee() {
  const items = [
    "Inventário rastreável por lote e validade",
    "Aplicações registradas por produto, dose e área",
    "Investimentos auditáveis em tempo real",
    "Comunicação direta com o consultor Rennova",
    "LGPD por desenho · zero dado de paciente",
    "Visão pareada especialista ↔ consultor"
  ];
  const loop = [...items, ...items];
  return (
    <div className="marquee">
      <div className="marquee-track">
        {loop.map((t, i) => <span key={i} className="marquee-item">{t}</span>)}
      </div>
    </div>
  );
}

Object.assign(window, { Nav, Hero, Marquee, HEADLINES, Chip });
