// sections-product.jsx — Problem (gaps paralelos) + módulos do produto

function Problem() {
  const isMobile = useBreakpoint();

  const gaps = {
    especialista: {
      header: "Especialista HOF",
      sub: "O que hoje passa despercebido na gestão da clínica",
      items: [
        ["Inventário no caderno, no fim do mês não bate.", "Estoque controlado por memória, planilha solta e foto de caixa. Validade descoberta na hora de aplicar."],
        ["Cada aplicação é um post-it.", "Qual lote foi usado, em que sessão, com qual dose — informação fragmentada entre planilha, agenda e a memória de quem aplicou."],
        ["Quanto entrou, quanto saiu, quanto rendeu?", "Compra-se pela urgência. Não se sabe o custo por procedimento, nem o retorno por linha de produto."],
        ["Falar com o consultor é sempre por WhatsApp avulso.", "Nenhum histórico estruturado da relação. Pedidos repetem-se. Recomendações se perdem."]
      ]
    },
    consultor: {
      header: "Consultor Rennova",
      sub: "O que hoje impede o consultor de exercer um papel realmente consultivo",
      items: [
        ["Visão da operação do cliente é zero.", "O consultor vê o que foi vendido por ele — não vê o que está no estoque, o que está sendo aplicado, nem o que está parado."],
        ["Recomendação fica no achismo.", "Sem dados de uso real, a sugestão de mix de produtos é genérica e perde força frente ao cliente."],
        ["Não se sabe quem está em ascensão ou em risco.", "Clientes com queda de procedimentos passam despercebidos até o pedido sumir."],
        ["O consultor responde — não antecipa.", "A relação reage à demanda do cliente, em vez de orientar a próxima fase do negócio dele."]
      ]
    }
  };

  return (
    <section id="problema" style={{ background: "var(--bg-2)" }}>
      <div className="wrap">
        <SectionHead
          num="01"
          label="O problema"
          title={<>Dois lados da mesma operação.<br /><span className="serif-it">Dois pontos cegos paralelos.</span></>}
          lede="A clínica HOF e a rede que a abastece operam, hoje, em superfícies separadas. O resultado é um custo silencioso para os dois lados — invisível porque ninguém tem a foto inteira."
        />

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 22 }}>
          {[gaps.especialista, gaps.consultor].map((col, ci) => (
            <Card key={ci} padding={0} style={{ borderColor: ci === 0 ? "var(--line-2)" : "var(--line)" }}>
              <div style={{
                padding: "22px 28px",
                borderBottom: "1px solid var(--line)",
                display: "flex", alignItems: "center", justifyContent: "space-between"
              }}>
                <div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--gold)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                    Lado {ci === 0 ? "A" : "B"}
                  </div>
                  <div style={{ marginTop: 6, fontFamily: "var(--serif)", fontSize: 22 }}>{col.header}</div>
                </div>
                <Icon name={ci === 0 ? "user" : "users"} size={22} color="var(--ink-3)" stroke={1.3} />
              </div>
              <div style={{ padding: "8px 28px 24px" }}>
                <div style={{ fontSize: 13, color: "var(--ink-3)", padding: "14px 0 4px", fontStyle: "italic" }}>
                  {col.sub}
                </div>
                {col.items.map(([t, d], i) => (
                  <div key={i} style={{
                    padding: "20px 0",
                    borderTop: "1px solid var(--line)"
                  }}>
                    <div style={{ fontFamily: "var(--serif)", fontSize: 17.5, lineHeight: 1.3, color: "var(--ink)" }}>
                      {t}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.6 }}>
                      {d}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <div style={{
          marginTop: 36, textAlign: "center",
          fontFamily: "var(--serif)", fontSize: "clamp(20px, 1.8vw, 26px)",
          fontStyle: "italic", color: "var(--ink-2)", maxWidth: 720, marginLeft: "auto", marginRight: "auto",
          lineHeight: 1.45
        }}>
          Curva Mestra é o sistema que junta <span style={{ color: "var(--gold-2)" }}>os dois lados</span> dessa operação em um único painel.
        </div>
      </div>
    </section>
  );
}

const MODULES = [
  {
    n: "01", id: "inventario",
    name: "Inventário inteligente",
    icon: "box",
    title: "Cada caixa, cada lote, cada validade.",
    desc: "Entrada por nota, saída por procedimento. Alertas automáticos de vencimento. Rastreabilidade total do produto Rennova dentro da operação clínica.",
    bullets: [
      "Entrada de lote por leitura de NF-e (XML)",
      "Validade com alertas de 60/30/15 dias",
      "Custo médio por linha e por unidade",
      "Posição de estoque por sala e por subestoque"
    ]
  },
  {
    n: "02", id: "procedimentos",
    name: "Aplicações & dosagem",
    icon: "syringe",
    title: "Cada aplicação registrada por produto, dose e área — não por paciente.",
    desc: "Curva Mestra registra a sessão como evento operacional: tipo de aplicação, produto, lote, dose e áreas. O dado de paciente fica integralmente no seu prontuário — nunca trafega para o sistema.",
    bullets: [
      "Modelos por tipo (full face, mid face, contorno, lábios, glabela…)",
      "Baixa automática do lote utilizado no estoque",
      "Identificador anônimo de sessão (sem PII)",
      "Histórico de uso por lote, por produto e por período"
    ]
  },
  {
    n: "03", id: "investimentos",
    name: "Investimentos & ROI",
    icon: "chart",
    title: "Quanto entrou em produto. Quanto saiu em procedimento. Quanto rendeu.",
    desc: "Visão de custo, ticket médio, margem por linha de produto e por tipo de procedimento. A primeira foto financeira honesta da operação HOF.",
    bullets: [
      "Custo direto por procedimento (FIFO por lote)",
      "Ticket médio por linha de produto",
      "Margem por categoria (HA, toxina, bioestimulador…)",
      "Projeção de necessidade de reposição"
    ]
  },
  {
    n: "04", id: "relatorios",
    name: "Relatórios gerenciais",
    icon: "doc",
    title: "Os relatórios que você apresentaria a um sócio. Prontos.",
    desc: "PDFs executivos de movimentação mensal, mix de produtos, sazonalidade e custo por linha. Compartilháveis com o consultor Rennova quando você quiser — sempre em visão agregada e anônima.",
    bullets: [
      "Fechamento mensal executivo (1 página)",
      "Mix de produtos por trimestre",
      "Custo por linha · curva de consumo",
      "Exportação em PDF e CSV"
    ]
  },
  {
    n: "05", id: "consultor",
    name: "Linha direta com o consultor",
    icon: "phone",
    title: "Uma relação consultiva. Não mais um chat de pedidos.",
    desc: "Canal estruturado com o consultor Rennova: histórico de pedidos, recomendações registradas, sugestões baseadas no uso real da clínica.",
    bullets: [
      "Card de recomendação compartilhável",
      "Histórico de pedidos e tickets",
      "Sugestão de reposição calculada pelo sistema",
      "Agenda de visitas e reuniões"
    ]
  }
];

function Modules() {
  const isMobile = useBreakpoint();

  return (
    <section id="sistema" style={{ background: "var(--bg)" }}>
      <div className="wrap">
        <SectionHead
          num="02"
          label="O sistema"
          title={<>Cinco módulos.<br /><span className="serif-it">Uma operação.</span></>}
          lede="Curva Mestra não substitui o prontuário, nem a agenda — completa ambos. É a camada operacional que liga produto, lote, aplicação e parceiro comercial em um único modelo de dados, sem nunca tocar em dado de paciente."
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
          {MODULES.map((m, i) => (
            <div key={m.id} style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "minmax(260px, 380px) 1fr",
              gap: isMobile ? 24 : 36,
              alignItems: "stretch",
              padding: "32px 0", borderTop: "1px solid var(--line)",
              borderBottom: i === MODULES.length - 1 ? "1px solid var(--line)" : "none"
            }}>
              <div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 12, marginBottom: 18
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 9,
                    background: "rgba(201,162,74,0.10)",
                    border: "1px solid var(--gold-3)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    color: "var(--gold)"
                  }}>
                    <Icon name={m.icon} size={18} stroke={1.6} />
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--gold)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                      Módulo {m.n}
                    </div>
                    <div style={{ marginTop: 2, fontFamily: "var(--serif)", fontSize: 22 }}>{m.name}</div>
                  </div>
                </div>
                <h3 style={{ fontSize: "clamp(24px, 2vw, 32px)", lineHeight: 1.15, fontFamily: "var(--serif)", fontWeight: 400 }}>
                  {m.title}
                </h3>
                <p className="muted" style={{ marginTop: 16, fontSize: 15, lineHeight: 1.6, maxWidth: 380 }}>
                  {m.desc}
                </p>
              </div>
              <div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                  {m.bullets.map((b, j) => (
                    <li key={j} style={{
                      display: "grid", gridTemplateColumns: "20px 1fr", gap: 12,
                      padding: "16px 18px",
                      background: "rgba(28,24,18,0.35)",
                      border: "1px solid var(--line)",
                      borderRadius: 10
                    }}>
                      <span style={{ color: "var(--gold)", marginTop: 1 }}>
                        <Icon name="check" size={14} stroke={2} />
                      </span>
                      <span style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.45 }}>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Problem, Modules, MODULES });
