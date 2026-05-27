// sections-personas.jsx — Duas seções de persona, cada uma com mock de UI

function ForSpecialist() {
  const isMobile = useBreakpoint();

  const benefits = [
    ["Estoque que se controla sozinho", "Você registra a aplicação; o sistema dá baixa no lote — e te avisa quando vai vencer."],
    ["Tempo administrativo cortado pela metade", "Fim do controle paralelo em planilha. Tudo em um modelo de dados único, sem nunca encostar em prontuário."],
    ["Dado de operação que era invisível, agora visível", "Cada aplicação vira dado financeiro automaticamente — custo por sessão, mix de produto, projeção de reposição. Sem trabalho extra."],
    ["Relação consultiva com o consultor Rennova", "Recomendações, pedidos e cronograma de uso em um canal — não em chat solto."]
  ];

  return (
    <section id="especialista" style={{ background: "var(--bg)" }}>
      <div className="wrap">
        <SectionHead
          num="03"
          label="Para o especialista HOF"
          title={<>Você cuida do <span className="serif-it">paciente</span>.<br />A Curva cuida da <span className="underline-gold">operação</span>.</>}
          lede="Desenhado a partir da rotina real de quem aplica — não da rotina imaginada por quem nunca aplicou. Cada tela existe para reduzir clique, não para gerar relatório."
        />

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.25fr 1fr", gap: isMobile ? 32 : 48, alignItems: "center" }}>
          <SpecialistMock />
          <div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 18 }}>
              {benefits.map(([t, d], i) => (
                <li key={i} style={{
                  display: "grid", gridTemplateColumns: "36px 1fr", gap: 16,
                  padding: "18px 0", borderTop: i === 0 ? "none" : "1px solid var(--line)"
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: "rgba(201,162,74,0.08)",
                    color: "var(--gold)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--mono)", fontSize: 11
                  }}>{String(i + 1).padStart(2, "0")}</div>
                  <div>
                    <div style={{ fontFamily: "var(--serif)", fontSize: 20, lineHeight: 1.3 }}>{t}</div>
                    <div style={{ marginTop: 6, fontSize: 14.5, color: "var(--ink-3)", lineHeight: 1.55 }}>{d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// Mock do especialista: tela de registro de aplicação — apenas dado operacional
function SpecialistMock() {
  return (
    <AppChrome title="curvamestra.app / aplicações / nova" role="DRA. HELENA VIDAL" height={520}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Nova aplicação
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, marginTop: 4 }}>Sessão #A-4218 · 23 mai 14:22</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Chip>Rascunho salvo</Chip>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
        {/* Esquerda: formulário de aplicação */}
        <Card padding={18}>
          <Row label="Tipo">
            <PillSelect options={["Full face", "Mid face", "Lábios", "Glabela"]} selected={1} />
          </Row>
          <Row label="Áreas">
            <FaceMap />
          </Row>
          <Row label="Produto · lote">
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(243,236,224,0.04)", border: "1px solid var(--line)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold)" }}></span>
              <span style={{ fontSize: 13, color: "var(--ink)" }}>Hyalux Ultra 1ml</span>
              <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--mono)", marginLeft: "auto" }}>HLX-2391 · val. 08/26</span>
            </div>
          </Row>
          <Row label="Dose aplicada">
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <div style={{ fontFamily: "var(--serif)", fontSize: 30, color: "var(--gold-2)" }}>0,8</div>
              <div style={{ fontSize: 13, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>ml · resta 0,2ml no lote</div>
            </div>
          </Row>
        </Card>

        {/* Direita: histórico do lote + efeitos automáticos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card padding={16}>
            <div style={{ fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.1em", color: "var(--ink-3)", textTransform: "uppercase" }}>
              Histórico do lote HLX-2391
            </div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["12 mai", "Mid face · sessão #A-4198", "0,4ml"],
                ["15 mai", "Mid face · sessão #A-4203", "0,5ml"],
                ["19 mai", "Lábios · sessão #A-4211", "0,3ml"],
                ["23 mai", "Mid face · sessão atual", "0,8ml", true]
              ].map(([d, what, dose, curr], i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "54px 1fr auto", gap: 8, fontSize: 12, alignItems: "center" }}>
                  <span style={{ color: curr ? "var(--gold)" : "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 11 }}>{d}</span>
                  <span style={{ color: curr ? "var(--ink)" : "var(--ink-2)" }}>{what}</span>
                  <span style={{ color: curr ? "var(--gold-2)" : "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 11 }}>{dose}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card padding={16}>
            <div style={{ fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.1em", color: "var(--gold)", textTransform: "uppercase" }}>
              Ao salvar, o sistema irá
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, color: "var(--ink-2)" }}>
              <li style={{ display: "flex", gap: 8 }}><Icon name="check" size={13} color="var(--gold)" stroke={2}/>Baixar 0,8ml do lote HLX-2391</li>
              <li style={{ display: "flex", gap: 8 }}><Icon name="check" size={13} color="var(--gold)" stroke={2}/>Calcular custo direto da sessão (R$ 162)</li>
              <li style={{ display: "flex", gap: 8 }}><Icon name="check" size={13} color="var(--gold)" stroke={2}/>Atualizar projeção de reposição</li>
              <li style={{ display: "flex", gap: 8, color: "var(--ink-3)" }}><Icon name="lock" size={13} color="var(--ink-3)" stroke={1.6}/>Sem registro de dados de paciente</li>
            </ul>
          </Card>
        </div>
      </div>
    </AppChrome>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 14, padding: "12px 0", borderTop: "1px solid var(--line)", alignItems: "center" }}>
      <div style={{ fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.1em", color: "var(--ink-3)", textTransform: "uppercase" }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function PillSelect({ options, selected }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o, i) => (
        <span key={i} style={{
          padding: "6px 12px", borderRadius: 99,
          fontSize: 12, fontFamily: "var(--mono)", letterSpacing: "0.02em",
          background: i === selected ? "var(--gold)" : "transparent",
          color: i === selected ? "#1a1304" : "var(--ink-3)",
          border: i === selected ? "1px solid var(--gold)" : "1px solid var(--line)"
        }}>{o}</span>
      ))}
    </div>
  );
}

// Mapa de face estilizado (ilustração leve, não anatômica)
function FaceMap() {
  return (
    <svg viewBox="0 0 200 80" width="100%" height="76" style={{ maxWidth: 280 }}>
      <ellipse cx="100" cy="40" rx="36" ry="36" fill="none" stroke="rgba(243,236,224,0.18)" strokeWidth="1"/>
      <ellipse cx="100" cy="30" rx="20" ry="6" fill="rgba(201,162,74,0.10)" stroke="var(--gold)" strokeWidth="1"/>
      <ellipse cx="82" cy="44" rx="8" ry="5" fill="rgba(201,162,74,0.05)" stroke="rgba(243,236,224,0.18)" strokeWidth="1"/>
      <ellipse cx="118" cy="44" rx="8" ry="5" fill="rgba(201,162,74,0.05)" stroke="rgba(243,236,224,0.18)" strokeWidth="1"/>
      <ellipse cx="100" cy="56" rx="10" ry="3" fill="rgba(243,236,224,0.04)" stroke="rgba(243,236,224,0.18)" strokeWidth="1"/>
      <text x="146" y="28" fill="var(--gold)" style={{ font: '500 9px var(--mono)', letterSpacing: '0.1em' }}>● MID FACE</text>
      <text x="146" y="46" fill="var(--ink-3)" style={{ font: '500 9px var(--mono)', letterSpacing: '0.1em' }}>○ BOCHECHA</text>
      <text x="146" y="60" fill="var(--ink-3)" style={{ font: '500 9px var(--mono)', letterSpacing: '0.1em' }}>○ LÁBIOS</text>
    </svg>
  );
}

function ForConsultor() {
  const isMobile = useBreakpoint();

  const benefits = [
    ["Visão real da carteira", "Estoque, procedimentos e mix de produto de cada cliente, em tempo real — quando o cliente autoriza."],
    ["Recomendação baseada em dado", "Sugestões de produto saem do achismo. Saem do padrão de consumo, da sazonalidade e da projeção de reposição."],
    ["Alertas que abrem conversas", "Cliente com queda no ritmo, lote prestes a vencer, novo padrão de procedimento — você é avisado antes do cliente."],
    ["Histórico de relacionamento estruturado", "Recomendações registradas, pedidos versionados, agenda comum. Nada se perde entre visitas."]
  ];

  return (
    <section id="consultor" style={{ background: "var(--bg-2)" }}>
      <div className="wrap">
        <SectionHead
          num="04"
          label="Para o consultor Rennova"
          title={<>De vendedor de pedido<br />a <span className="serif-it">parceiro estratégico</span>.</>}
          lede="Curva Mestra entrega ao consultor a única coisa que sempre faltou: visão real, autorizada pelo cliente, da operação que ele apoia. O resultado é uma relação que sai do reativo e entra no consultivo."
        />

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1.25fr", gap: isMobile ? 32 : 48, alignItems: "center" }}>
          <div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 18 }}>
              {benefits.map(([t, d], i) => (
                <li key={i} style={{
                  display: "grid", gridTemplateColumns: "36px 1fr", gap: 16,
                  padding: "18px 0", borderTop: i === 0 ? "none" : "1px solid var(--line)"
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: "rgba(201,162,74,0.08)",
                    color: "var(--gold)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--mono)", fontSize: 11
                  }}>{String(i + 1).padStart(2, "0")}</div>
                  <div>
                    <div style={{ fontFamily: "var(--serif)", fontSize: 20, lineHeight: 1.3 }}>{t}</div>
                    <div style={{ marginTop: 6, fontSize: 14.5, color: "var(--ink-3)", lineHeight: 1.55 }}>{d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <ConsultorMock />
        </div>
      </div>
    </section>
  );
}

// Mock do consultor: visão de carteira
function ConsultorMock() {
  const clients = [
    { n: "Dra. Helena Vidal", c: "Clínica Cíngulo · SP", s: "stable", val: "R$ 28.4k", trend: "+12%" },
    { n: "Dr. Bruno Aragão", c: "Concierge Estética · RJ", s: "rising", val: "R$ 41.2k", trend: "+34%" },
    { n: "Dra. Cláudia Sá", c: "Studio Sá · BH", s: "warn", val: "R$ 9.1k", trend: "−18%" },
    { n: "Dr. Igor Penna", c: "Penna HOF · POA", s: "stable", val: "R$ 22.7k", trend: "+4%" }
  ];
  const statusColor = { stable: "#4ade80", rising: "var(--gold-2)", warn: "#f59e0b" };
  const statusLabel = { stable: "Estável", rising: "Em ascensão", warn: "Atenção" };
  return (
    <AppChrome title="curvamestra.app / consultor / carteira" role="CARLOS REIS · RENNOVA" height={520}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Carteira · Sudeste 2
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, marginTop: 4 }}>14 clientes ativos</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Chip icon="search">Buscar</Chip>
          <Chip>Maio 2026</Chip>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 14 }}>
        {[
          { v: "R$ 312k", l: "Volume 30d", t: "+18%", a: true },
          { v: "11/14", l: "Estáveis ou em alta" },
          { v: "2", l: "Em alerta", warn: true },
          { v: "1", l: "Em ascensão" }
        ].map((k, i) => (
          <Card key={i} padding={14}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 22, lineHeight: 1, color: k.a ? "var(--gold-2)" : "var(--ink)" }}>{k.v}</div>
            <div style={{ marginTop: 6, fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{k.l}</div>
            {k.t && <div style={{ marginTop: 4, fontSize: 10.5, color: "#4ade80" }}>{k.t}</div>}
            {k.warn && <div style={{ marginTop: 4, fontSize: 10.5, color: "#f59e0b" }}>requer ação</div>}
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
        {/* Lista de clientes */}
        <Card padding={0}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.1em", color: "var(--ink-2)", textTransform: "uppercase" }}>Carteira · top movimento</div>
          </div>
          {clients.map((c, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "1fr auto auto", gap: 14, alignItems: "center",
              padding: "14px 18px", borderTop: i === 0 ? "none" : "1px solid var(--line)"
            }}>
              <div>
                <div style={{ fontSize: 13, color: "var(--ink)" }}>{c.n}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{c.c}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-2)" }}>{c.val}</div>
                <div style={{ fontSize: 10.5, color: c.trend.startsWith("−") ? "#f59e0b" : "#4ade80" }}>{c.trend}</div>
              </div>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "3px 8px", borderRadius: 4,
                background: "rgba(243,236,224,0.04)",
                color: statusColor[c.s],
                fontFamily: "var(--mono)", fontSize: 10
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor[c.s] }}></span>
                {statusLabel[c.s]}
              </span>
            </div>
          ))}
        </Card>

        {/* Card de sinais */}
        <Card padding={18}>
          <div style={{ fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.1em", color: "var(--gold)", textTransform: "uppercase" }}>
            Sinais da semana
          </div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              ["Dra. Helena", "2 lotes Hyalux vencem em 30d", "alert"],
              ["Dr. Bruno", "Subiu para Hyalux Ultra (+1 SKU)", "rising"],
              ["Dra. Cláudia", "Queda 18% em procedimentos · 30d", "alert"],
              ["Carteira", "Sazonalidade: pré-inverno · bioestimuladores", "info"]
            ].map(([who, what, kind], i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: 10 }}>
                <span style={{ marginTop: 4 }}>
                  <Icon name={kind === "alert" ? "alert" : (kind === "rising" ? "chart" : "eye")} size={13}
                        color={kind === "alert" ? "#f59e0b" : (kind === "rising" ? "var(--gold-2)" : "var(--ink-3)")}
                        stroke={1.5}/>
                </span>
                <div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.05em" }}>{who}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink)", marginTop: 2, lineHeight: 1.35 }}>{what}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppChrome>
  );
}

Object.assign(window, { ForSpecialist, ForConsultor });
