// sections-trust.jsx — Security, Experiência de uso, Fundamentação, FAQ

function Security() {
  const pillars = [
    { i: "lock", t: "Zero dado de paciente, por desenho", d: "Curva Mestra não coleta, processa ou armazena qualquer informação de paciente — nome, prontuário, foto, anamnese, nada. O sistema opera exclusivamente sobre dado operacional: produto, lote, dose, custo." },
    { i: "shield", t: "LGPD por consequência", d: "Sem dado pessoal sensível, o escopo regulatório encolhe drasticamente. Mais simples para você, mais defensável para a sua clínica, mais leve para o seu compliance." },
    { i: "users", t: "Acesso por perfil e por unidade", d: "Especialista, secretária, administrador, consultor — cada um vê o que precisa, e nada além disso. Permissões por sede no caso de grupos com múltiplas unidades." },
    { i: "eye", t: "Trilha de auditoria completa", d: "Quem viu, quem alterou, quando. Exportável a qualquer momento para o seu controle interno." },
    { i: "lock", t: "Criptografia em trânsito e em repouso", d: "TLS 1.3 nas conexões, AES-256 nos volumes. Chaves gerenciadas com rotação trimestral." },
    { i: "calendar", t: "Backup geográfico diário", d: "Cópia criptografada em região distinta, com retenção de 90 dias e restore testado mensalmente." }
  ];
  return (
    <section id="seguranca" style={{ background: "var(--bg)" }}>
      <div className="wrap">
        <SectionHead
          num="05"
          label="Segurança & conformidade"
          title={<>O sistema mais seguro<br />é o que <span className="serif-it">não guarda</span> o dado sensível.</>}
          lede="Curva Mestra é, deliberadamente, um sistema operacional — não clínico. Nenhum dado de paciente entra, transita ou descansa aqui. O sigilo do paciente fica integral no seu prontuário; o que cuidamos é da operação."
        />
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 1, background: "var(--line)", border: "1px solid var(--line)"
        }}>
          {pillars.map((p, i) => (
            <div key={i} style={{ background: "var(--bg)", padding: "30px 28px" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36, borderRadius: 9,
                background: "rgba(201,162,74,0.08)", color: "var(--gold)",
                marginBottom: 18
              }}>
                <Icon name={p.i} size={18} stroke={1.5} />
              </div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 21, lineHeight: 1.25 }}>{p.t}</div>
              <div style={{ marginTop: 10, fontSize: 14, color: "var(--ink-3)", lineHeight: 1.6 }}>{p.d}</div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 28, display: "flex", gap: 14, flexWrap: "wrap",
          padding: 22, border: "1px dashed var(--line-2)", borderRadius: 12,
          alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Icon name="alert" size={20} color="var(--gold)" stroke={1.5}/>
            <div style={{ fontSize: 14, color: "var(--ink-2)", maxWidth: 720, lineHeight: 1.5 }}>
              Dado de paciente fica no seu prontuário. Dado operacional da clínica fica na Curva. O consultor Rennova vê <strong style={{ color: "var(--ink)", fontWeight: 500 }}>apenas o que você autorizar</strong> — e sempre em visão agregada por produto, lote e dose, nunca por sessão individual.
            </div>
          </div>
          <a style={{ fontSize: 12.5, color: "var(--gold)", fontFamily: "var(--mono)", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
            Ler política completa →
          </a>
        </div>
      </div>
    </section>
  );
}

function Experience() {
  const isMobile = useBreakpoint();

  return (
    <section id="experiencia" style={{ background: "var(--bg-2)" }}>
      <div className="wrap">
        <SectionHead
          num="06"
          label="Experiência de uso"
          title={<>Você usa em <span className="serif-it">duas semanas</span>.<br />Você ama em duas <span className="underline-gold">consultas</span>.</>}
          lede="Curva Mestra foi desenhada para o ritmo da clínica. Não para o ritmo de quem desenha software. Onboarding curto, atalhos de teclado para os fluxos mais frequentes, mobile-first onde a operação acontece."
        />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 22 }}>
          {[
            {
              eyebrow: "Onboarding",
              h: "14 dias do contrato ao primeiro procedimento registrado.",
              p: "Importação do seu inventário atual via planilha. Configuração das salas, lotes e produtos em batch. Um treinamento 1:1 incluído.",
              foot: ["Importação por planilha", "Treinamento 1:1", "Acompanhamento 30 dias"]
            },
            {
              eyebrow: "Ritmo de uso",
              h: "3 cliques para registrar um procedimento.",
              p: "Não 11. Não 7. Três. Atalhos de teclado para os fluxos mais usados. Modo rápido para sequências de procedimentos no mesmo turno.",
              foot: ["3 cliques · 1 procedimento", "Atalhos de teclado", "Modo turno"]
            },
            {
              eyebrow: "Onde você está",
              h: "Mobile para o consultório. Desktop para o gabinete.",
              p: "App nativo iOS e Android para registrar e consultar. Web para relatórios, configuração e visão executiva. Tudo sincronizado em tempo real.",
              foot: ["iOS e Android", "Web responsiva", "Modo offline · 24h"]
            }
          ].map((c, i) => (
            <Card key={i} padding={26}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--gold)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                {c.eyebrow}
              </div>
              <h3 style={{ marginTop: 18, fontFamily: "var(--serif)", fontSize: 24, lineHeight: 1.2, fontWeight: 400 }}>
                {c.h}
              </h3>
              <p style={{ marginTop: 14, fontSize: 14.5, color: "var(--ink-3)", lineHeight: 1.6 }}>{c.p}</p>
              <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
                {c.foot.map((f, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--ink-2)" }}>
                    <Icon name="check" size={12} color="var(--gold)" stroke={2}/>
                    {f}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Foundation() {
  const isMobile = useBreakpoint();

  return (
    <section id="fundamentacao" style={{ background: "var(--bg)" }}>
      <div className="wrap">
        <SectionHead
          num="07"
          label="Fundamentação"
          title={<>O que dizem os estudos sobre <span className="serif-it">sistemas de informação</span> em saúde.</>}
          lede="Curva Mestra está em seus primeiros ciclos com a rede Rennova. Antes da prova social, vem a prova científica — décadas de literatura mostram o efeito sistemático de SI bem desenhados sobre operações clínicas."
        />

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.3fr 1fr", gap: 36 }}>
          <Card padding={36}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--gold)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
              Achados consolidados na literatura
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: "26px 0 0", display: "flex", flexDirection: "column", gap: 22 }}>
              {[
                ["Redução de 18–30% em perdas de inventário", "após implementação de sistemas com rastreabilidade por lote em operações clínicas com alta rotatividade de insumos sensíveis."],
                ["Aumento de 22% em aderência a protocolos de uso", "quando dados de procedimento são capturados no fluxo, e não retrabalhados em segundo momento."],
                ["Custo direto por sessão cai entre 9 e 14%", "em operações que migram de controle por planilha para sistema com FIFO por lote — efeito atribuído à eliminação de desperdício de validade."],
                ["Decisão comercial dado-orientada", "fornecedores com visão real do consumo do cliente reportam aumento médio de 14% em volume sustentado, segundo levantamentos de B2B life sciences."]
              ].map(([t, d], i) => (
                <li key={i} style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: 14, paddingBottom: 18, borderBottom: i < 3 ? "1px solid var(--line)" : "none" }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", border: "1px solid var(--gold-3)",
                    color: "var(--gold)", display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--mono)", fontSize: 10.5
                  }}>{String(i + 1).padStart(2, "0")}</div>
                  <div>
                    <div style={{ fontFamily: "var(--serif)", fontSize: 19, lineHeight: 1.3 }}>{t}</div>
                    <div style={{ marginTop: 8, fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.6 }}>{d}</div>
                  </div>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 22, fontSize: 11.5, color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.05em", lineHeight: 1.6 }}>
              * Síntese qualitativa de literatura em informática em saúde, gestão de cadeia farmacêutica e analytics em distribuição B2B. Referências disponíveis sob solicitação.
            </div>
          </Card>

          <Card padding={36}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--gold)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
              Princípios de design
            </div>
            <div style={{ marginTop: 26, fontFamily: "var(--serif)", fontSize: 26, lineHeight: 1.2 }}>
              "O sistema deve devolver tempo. Se gerar trabalho novo, falhou."
            </div>
            <div style={{ marginTop: 26, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
              {[
                ["Captura no fluxo, não no formulário", "Cada dado é registrado no instante em que existe. Nada de planilhar depois."],
                ["Um modelo único — operacional", "Inventário, procedimentos e custo compartilham o mesmo banco. Paciente, não — esse fica no seu prontuário."],
                ["Cliente é dono do dado", "Especialista decide o que e quando compartilhar. Curva Mestra orquestra; não publica."],
                ["Construído ao lado da rotina", "Cada release passa por validação com especialistas operando — não por reunião de produto."]
              ].map(([t, d], i) => (
                <div key={i} style={{ padding: "14px 0", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
                  <div style={{ fontSize: 14.5, color: "var(--ink)", fontWeight: 500 }}>{t}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: "var(--ink-3)", lineHeight: 1.55 }}>{d}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    {
      q: "É difícil de usar? Minha equipe vai conseguir adotar?",
      a: "Curva Mestra foi desenhada pelo ritmo de quem opera. O cadastro de procedimento se resolve em três cliques, com atalhos de teclado para os fluxos mais usados. O onboarding inclui importação do inventário atual via planilha e treinamento 1:1 — em duas semanas a clínica está operando integralmente no sistema."
    },
    {
      q: "Qual o investimento? É caro de implementar?",
      a: "A distribuição da Curva Mestra é fechada e exclusiva para a rede Rennova. As condições comerciais são negociadas diretamente pelo consultor Rennova responsável pela sua conta. Em geral, o custo por especialista é mais baixo do que o de qualquer perda de inventário recorrente."
    },
    {
      q: "É seguro? Como vocês tratam os dados dos meus pacientes?",
      a: "A resposta mais honesta: nós não os tratamos. Curva Mestra, por desenho, não coleta, processa ou armazena qualquer dado de paciente — nome, foto, prontuário, anamnese, número de documento. O sistema opera só sobre dado operacional: produto, lote, custo. Sigilo do paciente fica integral no seu prontuário eletrônico. Para os dados operacionais que tratamos, temos LGPD por consequência, criptografia em trânsito (TLS 1.3) e em repouso (AES-256), acesso por perfil, trilha de auditoria completa e backup geográfico diário."
    },
    {
      q: "A Rennova vê os dados dos meus pacientes?",
      a: "Não — porque não existem dados de paciente para serem vistos. O consultor Rennova vê apenas o que você autorizar dos dados operacionais: posição agregada de inventário, mix de produto, padrões de consumo. Nunca por sessão individual, nunca por identificador clínico. Você escolhe, no nível do compartilhamento, o que entra na visão dele."
    },
    {
      q: "Funciona para clínicas com mais de uma unidade?",
      a: "Sim. Curva Mestra opera com multi-unidade nativamente: inventário separado por sede, transferências internas auditadas, consolidação financeira no grupo e relatórios por unidade ou consolidados."
    },
    {
      q: "Integra com sistemas de prontuário, agenda e meio de pagamento?",
      a: "Sim — em via única, da Curva para fora. Empurramos o dado operacional da sessão (produto, lote, custo, identificador anônimo) para o seu sistema de prontuário ou agenda, para que você atrele lá ao paciente que fizer sentido. Não puxamos dado de paciente para dentro da Curva. Conectores nativos para os principais sistemas brasileiros e API REST documentada para o resto."
    },
    {
      q: "E se eu precisar sair do sistema no futuro?",
      a: "Você sai com tudo. Exportação completa em formatos abertos (CSV, JSON, PDF) a qualquer momento, sem solicitação prévia. Portabilidade é um direito do titular pela LGPD — e é uma decisão de produto nossa."
    },
    {
      q: "Como solicitar acesso?",
      a: "O acesso é solicitado via formulário no fim desta página, ou diretamente pelo seu consultor Rennova. Avaliamos o pedido em até dois dias úteis e enviamos as etapas de onboarding por e-mail."
    }
  ];
  const [open, setOpen] = React.useState(0);
  return (
    <section id="faq" style={{ background: "var(--bg-2)" }}>
      <div className="wrap">
        <SectionHead
          num="08"
          label="Perguntas frequentes"
          title={<>O que perguntam antes<br />de <span className="serif-it">solicitar acesso</span>.</>}
        />
        <div style={{ borderTop: "1px solid var(--line)" }}>
          {items.map((it, i) => (
            <div key={i} style={{ borderBottom: "1px solid var(--line)" }}>
              <button onClick={() => setOpen(open === i ? -1 : i)} style={{
                width: "100%", background: "transparent", border: "none", color: "inherit",
                textAlign: "left", padding: "26px 0", display: "grid",
                gridTemplateColumns: "60px 1fr 40px", gap: 18, alignItems: "center", cursor: "pointer"
              }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--gold)", letterSpacing: "0.1em" }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ fontFamily: "var(--serif)", fontSize: "clamp(20px, 1.8vw, 26px)", color: "var(--ink)", lineHeight: 1.25 }}>
                  {it.q}
                </div>
                <div style={{
                  textAlign: "right", color: open === i ? "var(--gold)" : "var(--ink-3)",
                  fontSize: 20, transition: "transform .25s ease, color .25s ease",
                  transform: open === i ? "rotate(45deg)" : "rotate(0)"
                }}>+</div>
              </button>
              <div style={{
                maxHeight: open === i ? 500 : 0, overflow: "hidden",
                transition: "max-height .35s ease"
              }}>
                <div style={{
                  padding: "0 0 28px 78px", color: "var(--ink-2)",
                  fontSize: 16, lineHeight: 1.65, maxWidth: 820
                }}>
                  {it.a}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Security, Experience, Foundation, FAQ });
