// sections-cta.jsx — Formulário de acesso + Rodapé

function RequestAccess() {
  const [role, setRole] = React.useState("especialista");
  const [submitted, setSubmitted] = React.useState(false);
  const [submittedId, setSubmittedId] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [apiError, setApiError] = React.useState(null);
  const [volume, setVolume] = React.useState("30–80");
  const isMobile = useBreakpoint();

  // Campos controlados
  const [fields, setFields] = React.useState({
    fullName: "",
    councilNumber: "",
    email: "",
    phone: "",
    businessName: "",
    consultantReference: "",
  });

  const setField = (key, value) => setFields((prev) => ({ ...prev, [key]: value }));

  // Formatação de telefone
  const handlePhoneChange = (e) => {
    const cleaned = e.target.value.replace(/\D/g, "");
    let formatted = cleaned;
    if (cleaned.length > 2) formatted = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    if (cleaned.length > 7) formatted = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
    setField("phone", formatted);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setApiError(null);
    setLoading(true);

    try {
      const body = {
        role,
        full_name: fields.fullName.trim(),
        council_number: fields.councilNumber.trim(),
        email: fields.email.trim(),
        phone: fields.phone.trim(),
        business_name: fields.businessName.trim(),
      };
      if (role === "especialista") {
        body.volume = volume;
        if (fields.consultantReference.trim()) {
          body.consultant_reference = fields.consultantReference.trim();
        }
      }

      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSubmittedId(data.id);
        setSubmitted(true);
      } else {
        setApiError(data.error || "Erro ao enviar solicitação. Tente novamente.");
      }
    } catch (err) {
      setApiError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "12px 14px",
    background: "rgba(243,236,224,0.03)",
    border: "1px solid var(--line-2)", borderRadius: 8,
    color: "var(--ink)", fontSize: 14,
    fontFamily: "var(--sans)",
    outline: "none", transition: "border-color .2s ease, background .2s ease",
    boxSizing: "border-box",
  };
  const inputStyleMono = { ...inputStyle, fontFamily: "var(--mono)" };

  const onFocus = (e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.background = "rgba(201,162,74,0.04)"; };
  const onBlur  = (e) => { e.target.style.borderColor = "var(--line-2)"; e.target.style.background = "rgba(243,236,224,0.03)"; };

  return (
    <section id="acesso" style={{
      background: "linear-gradient(180deg, var(--bg) 0%, #14110d 100%)",
      paddingBottom: 90
    }}>
      <div className="wrap">
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: isMobile ? 40 : 56,
          alignItems: "start"
        }}>
          <div style={{ paddingTop: 16 }}>
            <div className="section-num">09 · Solicitar acesso</div>
            <h2 style={{ marginTop: 18, fontSize: "clamp(40px, 4.8vw, 64px)", lineHeight: 1.02 }}>
              Curva Mestra é<br />
              <span className="serif-it">distribuição fechada.</span>
            </h2>
            <p className="muted" style={{ marginTop: 26, maxWidth: 540, fontSize: 17, lineHeight: 1.65 }}>
              Solicite acesso pelo formulário ao lado, ou diretamente pelo seu consultor Rennova. Cada pedido é avaliado em até <strong style={{ color: "var(--gold-2)", fontWeight: 500 }}>2 dias úteis</strong> e respondido por e-mail com as etapas do onboarding.
            </p>

            <div style={{
              marginTop: 36, padding: "26px 28px",
              border: "1px solid var(--line-2)", borderRadius: 12,
              background: "linear-gradient(180deg, rgba(28,24,18,0.4), rgba(20,17,13,0.2))"
            }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--gold)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                O que esperar depois
              </div>
              <ol style={{ listStyle: "none", padding: 0, margin: "18px 0 0", display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  ["Em 2 dias úteis", "Resposta com confirmação ou pedido de informação adicional."],
                  ["Em até 7 dias", "Reunião de descoberta com a equipe Curva Mestra (60 min, online)."],
                  ["Em até 14 dias", "Onboarding técnico, importação de inventário e treinamento 1:1."],
                  ["A partir de então", "Primeiro procedimento registrado no sistema. A operação muda."]
                ].map(([when, what], i) => (
                  <li key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 14, fontSize: 13.5 }}>
                    <span style={{ color: "var(--gold-2)", fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.05em", paddingTop: 1 }}>{when}</span>
                    <span style={{ color: "var(--ink-2)", lineHeight: 1.5 }}>{what}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div style={{
              marginTop: 26, fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.7,
              display: "flex", alignItems: "center", gap: 10
            }}>
              <Icon name="phone" size={14} color="var(--gold)" stroke={1.6}/>
              <span>Tem um consultor Rennova com você? Peça para que ele inicie o pedido — fica mais rápido.</span>
            </div>
          </div>

          {/* Formulário */}
          <div style={{
            padding: "36px 38px",
            background: "linear-gradient(180deg, rgba(28,24,18,0.6), rgba(20,17,13,0.4))",
            border: "1px solid var(--gold-3)",
            borderRadius: 16,
            boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,162,74,0.12)"
          }}>
            {!submitted ? (
              <form onSubmit={onSubmit}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--gold)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6 }}>
                  Formulário · Cohort restrita
                </div>
                <h3 style={{ fontFamily: "var(--serif)", fontSize: 28, lineHeight: 1.15, marginBottom: 28 }}>
                  Quem você é?
                </h3>

                {/* Seletor de perfil */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
                  {[
                    { v: "especialista", t: "Especialista HOF", d: "Operação clínica" },
                    { v: "consultor", t: "Consultor Rennova", d: "Acesso comercial" }
                  ].map((r) => {
                    const active = role === r.v;
                    return (
                      <button key={r.v} type="button" onClick={() => setRole(r.v)} style={{
                        padding: "16px 16px", textAlign: "left", borderRadius: 10,
                        border: active ? "1px solid var(--gold)" : "1px solid var(--line-2)",
                        background: active ? "rgba(201,162,74,0.08)" : "transparent",
                        color: "var(--ink)", cursor: "pointer", transition: "all .2s ease"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            width: 14, height: 14, borderRadius: "50%",
                            border: active ? "1.5px solid var(--gold)" : "1.5px solid var(--ink-3)",
                            display: "inline-flex", alignItems: "center", justifyContent: "center"
                          }}>
                            {active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold)" }}></span>}
                          </span>
                          <span style={{ fontFamily: "var(--serif)", fontSize: 16 }}>{r.t}</span>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--ink-3)", paddingLeft: 22 }}>{r.d}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Nome + Conselho */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.08em", color: "var(--ink-3)", textTransform: "uppercase", marginBottom: 6 }}>
                      Nome completo
                    </label>
                    <input
                      type="text"
                      placeholder="Ex.: Helena Vidal"
                      required
                      value={fields.fullName}
                      onChange={(e) => setField("fullName", e.target.value)}
                      style={inputStyle}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.08em", color: "var(--ink-3)", textTransform: "uppercase", marginBottom: 6 }}>
                      {role === "especialista" ? "CRM / CRO / nº conselho" : "ID Rennova"}
                    </label>
                    <input
                      type="text"
                      placeholder={role === "especialista" ? "Ex.: CRM-SP 142337" : "Ex.: RNV-CR-0427"}
                      required
                      value={fields.councilNumber}
                      onChange={(e) => setField("councilNumber", e.target.value)}
                      style={inputStyleMono}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                  </div>
                </div>

                {/* E-mail */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.08em", color: "var(--ink-3)", textTransform: "uppercase", marginBottom: 6 }}>
                    E-mail profissional
                  </label>
                  <input
                    type="email"
                    placeholder="voce@clinica.com.br"
                    required
                    value={fields.email}
                    onChange={(e) => setField("email", e.target.value)}
                    style={inputStyle}
                    onFocus={onFocus} onBlur={onBlur}
                  />
                </div>

                {/* Telefone + Clínica/Região */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.08em", color: "var(--ink-3)", textTransform: "uppercase", marginBottom: 6 }}>
                      Telefone / WhatsApp
                    </label>
                    <input
                      type="tel"
                      placeholder="(11) 9 9999-9999"
                      required
                      value={fields.phone}
                      onChange={handlePhoneChange}
                      maxLength={15}
                      style={inputStyle}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.08em", color: "var(--ink-3)", textTransform: "uppercase", marginBottom: 6 }}>
                      {role === "especialista" ? "Nome da clínica" : "Região / carteira"}
                    </label>
                    <input
                      type="text"
                      placeholder={role === "especialista" ? "Ex.: Clínica Cíngulo" : "Ex.: Sudeste 2"}
                      required
                      value={fields.businessName}
                      onChange={(e) => setField("businessName", e.target.value)}
                      style={inputStyle}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                  </div>
                </div>

                {/* Campos exclusivos do especialista */}
                {role === "especialista" && (
                  <>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.08em", color: "var(--ink-3)", textTransform: "uppercase", marginBottom: 6 }}>
                        Consultor Rennova de referência <span style={{ fontWeight: 400, opacity: 0.6 }}>(opcional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Nome do seu consultor"
                        value={fields.consultantReference}
                        onChange={(e) => setField("consultantReference", e.target.value)}
                        style={inputStyle}
                        onFocus={onFocus} onBlur={onBlur}
                      />
                    </div>
                    <div style={{ marginBottom: 22 }}>
                      <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.08em", color: "var(--ink-3)", textTransform: "uppercase", marginBottom: 8 }}>
                        Volume aproximado de procedimentos por mês
                      </label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {["Até 30", "30–80", "80–150", "150+"].map((v, i) => (
                          <span key={i} onClick={() => setVolume(v)} style={{
                            padding: "8px 14px", borderRadius: 99,
                            fontSize: 12.5,
                            color: volume === v ? "var(--gold)" : "var(--ink-2)",
                            background: volume === v ? "rgba(201,162,74,0.10)" : "transparent",
                            border: volume === v ? "1px solid var(--gold)" : "1px solid var(--line-2)",
                            cursor: "pointer",
                            fontFamily: "var(--mono)", letterSpacing: "0.02em",
                            transition: "all .2s ease"
                          }}>{v}</span>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Erro da API */}
                {apiError && (
                  <div style={{
                    marginBottom: 16, padding: "12px 14px", borderRadius: 8,
                    background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)",
                    fontSize: 13, color: "#f87171", lineHeight: 1.5
                  }}>
                    {apiError}
                  </div>
                )}

                {/* Checkbox */}
                <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 4,
                    border: "1px solid var(--gold)", marginTop: 2,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(201,162,74,0.08)"
                  }}>
                    <Icon name="check" size={11} color="var(--gold)" stroke={2.4}/>
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
                    Concordo em receber comunicação relacionada à Curva Mestra e entendo que meus dados são tratados conforme a <a style={{ color: "var(--gold-2)", borderBottom: "1px solid var(--gold-3)" }}>política de privacidade</a>.
                  </span>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ width: "100%", opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
                  disabled={loading}
                >
                  {loading ? "Enviando..." : "Solicitar acesso à Curva Mestra"} {!loading && <span className="arrow">→</span>}
                </button>
                <div style={{ marginTop: 12, textAlign: "center", fontSize: 11.5, color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.05em" }}>
                  Resposta em até 2 dias úteis · Avaliação caso a caso
                </div>
              </form>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{
                  width: 60, height: 60, borderRadius: "50%",
                  border: "1px solid var(--gold)", color: "var(--gold)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 22px"
                }}>
                  <Icon name="check" size={26} stroke={1.8} color="var(--gold)"/>
                </div>
                <h3 style={{ fontFamily: "var(--serif)", fontSize: 30, lineHeight: 1.15 }}>
                  Pedido recebido.
                </h3>
                <p style={{ marginTop: 18, color: "var(--ink-2)", fontSize: 15.5, lineHeight: 1.65, maxWidth: 360, marginLeft: "auto", marginRight: "auto" }}>
                  Nossa equipe entrará em contato em até <strong style={{ color: "var(--gold-2)", fontWeight: 500 }}>2 dias úteis</strong> com os próximos passos.
                </p>
                {submittedId && (
                  <div style={{ marginTop: 26, paddingTop: 22, borderTop: "1px solid var(--line)" }}>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Protocolo</div>
                    <div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink)", letterSpacing: "0.04em" }}>
                      {submittedId}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const isMobile = useBreakpoint();

  const columns = [
    ["Produto", [
      ["O sistema", "#sistema"],
      ["Para o especialista", "#especialista"],
      ["Para o consultor", "#consultor"],
      ["Segurança", "#seguranca"]
    ]],
    ["Recursos", [
      ["Documentação", null],
      ["Status do sistema", null],
      ["Ajuda & suporte", null],
      ["Releases", null]
    ]],
    ["Contato", [
      ["Solicitar acesso", "#acesso"],
      ["Falar com vendas", "#acesso"],
      ["scandelari.guilherme@curvamestra.com.br", "mailto:scandelari.guilherme@curvamestra.com.br"],
      ["São Paulo · BR", null]
    ]]
  ];

  return (
    <footer style={{
      borderTop: "1px solid var(--line)", background: "#0a0908",
      padding: "60px 0 40px"
    }}>
      <div className="wrap">
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr 1fr 1fr",
          gap: isMobile ? 32 : 36,
          paddingBottom: 40, borderBottom: "1px solid var(--line)"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src="assets/logo.png" alt="" style={{ width: 38, height: 38, borderRadius: 8, border: "1px solid var(--line-2)" }}/>
              <div style={{ fontFamily: "var(--serif)", fontSize: 22 }}>Curva <em style={{ color: "var(--gold-2)", fontWeight: 300 }}>Mestra</em></div>
            </div>
            <p style={{ marginTop: 18, fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.6, maxWidth: 360 }}>
              Sistema de gestão clínica para harmonização orofacial e corporal. Distribuição fechada à rede Rennova de especialistas e consultores.
            </p>
          </div>
          {columns.map(([h, links], i) => (
            <div key={i}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--gold)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 18 }}>
                {h}
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {links.map(([text, href], j) => (
                  <li key={j}>
                    <a href={href || undefined} style={{ color: "var(--ink-2)", fontSize: 13.5 }}>{text}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 28, display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.05em",
          flexWrap: "wrap", gap: 14
        }}>
          <div>© 2026 Curva Mestra</div>
          <div style={{ display: "flex", gap: 22 }}>
            <a>Política de privacidade</a>
            <a>Termos de uso</a>
            <a>LGPD</a>
          </div>
        </div>
        <div style={{ marginTop: 22, fontSize: 11, color: "var(--ink-3)", maxWidth: 720, lineHeight: 1.6 }}>
          Curva Mestra é um produto independente, oferecido em distribuição parceira à rede Rennova. Não constitui endosso, parceria comercial formal ou subsidiária de terceiros mencionados nesta página.
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { RequestAccess, Footer });
