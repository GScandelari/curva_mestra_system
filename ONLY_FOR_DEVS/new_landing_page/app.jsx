// app.jsx — Composition + Tweaks

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "headline": "precisao",
  "palette": ["#e3c075", "#c9a24a", "#8a6b22"],
  "showMarquee": true,
  "showFoundation": true
}/*EDITMODE-END*/;

const PALETTE_OPTIONS = [
  ["#e3c075", "#c9a24a", "#8a6b22"],   // gold (default)
  ["#f0d9a3", "#d8b878", "#9a814a"],   // champagne
  ["#d49a5a", "#a8763a", "#6e4b1f"]    // bronze
];

function applyPalette(arr) {
  const [g1, g, g3] = arr;
  const r = document.documentElement;
  r.style.setProperty("--gold", g);
  r.style.setProperty("--gold-2", g1);
  r.style.setProperty("--gold-3", g3);
  // glow derived from main gold at 22% alpha
  const hex = g.replace("#", "");
  const x = hex.length === 3 ? hex.replace(/./g, c => c + c) : hex;
  const R = parseInt(x.substr(0,2),16), G = parseInt(x.substr(2,2),16), B = parseInt(x.substr(4,2),16);
  r.style.setProperty("--gold-glow", `rgba(${R},${G},${B},0.22)`);
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => { applyPalette(t.palette); }, [t.palette]);

  return (
    <>
      <Nav />
      <Hero headlineVariant={t.headline} />
      {t.showMarquee && <Marquee />}
      <Problem />
      <Modules />
      <ForSpecialist />
      <ForConsultor />
      <Security />
      <Experience />
      {t.showFoundation && <Foundation />}
      <FAQ />
      <RequestAccess />
      <Footer />

      <TweaksPanel title="Tweaks · Curva Mestra">
        <TweakSection label="Headline" />
        <TweakSelect
          label="Variante"
          value={t.headline}
          options={[
            { value: "inventario", label: "Inventário, procedimentos…" },
            { value: "curva", label: "A curva entre especialista e consultor" },
            { value: "precisao", label: "Precisão clínica · visão gerencial" }
          ]}
          onChange={(v) => setTweak("headline", v)}
        />
        <TweakSection label="Paleta" />
        <TweakColor
          label="Tom dourado"
          value={t.palette}
          options={PALETTE_OPTIONS}
          onChange={(v) => setTweak("palette", v)}
        />
        <TweakSection label="Seções opcionais" />
        <TweakToggle label="Marquee de features"
                     value={t.showMarquee}
                     onChange={(v) => setTweak("showMarquee", v)} />
        <TweakToggle label="Bloco de fundamentação"
                     value={t.showFoundation}
                     onChange={(v) => setTweak("showFoundation", v)} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
