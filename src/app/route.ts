/**
 * Route Handler raiz — serve a landing page como HTML bruto.
 *
 * Por que Route Handler e não page.tsx:
 *  - page.tsx passa pelo layout.tsx (html/body extras, fonts, providers)
 *  - route.ts retorna uma Response HTTP direta, sem wrapping React
 *  - A landing page tem seu próprio <html>, <head> e <body>
 *
 * Os arquivos JSX ficam em public/landing/ e são servidos pelo Firebase CDN.
 * O <base href="/landing/"> no HTML garante que todos os scripts e assets
 * resolvam para /landing/*.jsx independentemente de onde a página é servida.
 *
 * Para atualizar o HTML: edite também public/landing/index.html (cópia de referência).
 */

export const dynamic = 'force-dynamic';

const LANDING_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<base href="/landing/" />
<title>Curva Mestra — Sistema de gestão para harmonização orofacial e corporal</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500&family=Inter+Tight:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

<style>
  :root {
    --bg: #0a0908;
    --bg-2: #14110d;
    --bg-3: #1c1812;
    --ink: #f3ece0;
    --ink-2: #c8bfae;
    --ink-3: #8a8270;
    --line: rgba(243, 236, 224, 0.10);
    --line-2: rgba(243, 236, 224, 0.18);
    --gold: #c9a24a;
    --gold-2: #e3c075;
    --gold-3: #8a6b22;
    --gold-glow: rgba(201, 162, 74, 0.22);
    --serif: "Fraunces", "Times New Roman", serif;
    --sans: "Inter Tight", system-ui, -apple-system, sans-serif;
    --mono: "JetBrains Mono", ui-monospace, monospace;
    --maxw: 1180px;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--ink); }
  body {
    font-family: var(--sans);
    font-size: 17px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    overflow-x: hidden;
  }
  ::selection { background: var(--gold); color: #000; }

  a { color: inherit; text-decoration: none; }
  button { font: inherit; cursor: pointer; }

  .wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 28px; }
  .eyebrow {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--gold);
  }
  .eyebrow .dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%;
    background: var(--gold); margin-right: 10px; vertical-align: middle; transform: translateY(-1px); }

  h1, h2, h3, h4 { font-family: var(--serif); font-weight: 400; letter-spacing: -0.02em;
    line-height: 1.05; margin: 0; font-optical-sizing: auto; }
  .serif-it { font-style: italic; font-weight: 300; color: var(--gold-2); }
  .underline-gold { background-image: linear-gradient(var(--gold), var(--gold));
    background-size: 100% 1px; background-repeat: no-repeat; background-position: 0 100%;
    padding-bottom: 2px; }

  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 10px;
    padding: 16px 26px; border-radius: 999px; border: 1px solid transparent;
    font-family: var(--sans); font-size: 14.5px; font-weight: 600;
    letter-spacing: 0.01em; transition: transform .15s ease, box-shadow .25s ease, background .25s ease;
    text-align: center;
  }
  .btn-primary {
    background: linear-gradient(180deg, var(--gold-2) 0%, var(--gold) 55%, var(--gold-3) 100%);
    color: #1a1304;
    box-shadow:
      0 1px 0 rgba(255, 230, 170, 0.55) inset,
      0 -1px 0 rgba(0,0,0,0.25) inset,
      0 8px 28px -8px var(--gold-glow),
      0 0 0 1px rgba(201, 162, 74, 0.4);
  }
  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 230, 170, 0.7) inset,
      0 -1px 0 rgba(0,0,0,0.25) inset,
      0 14px 40px -10px var(--gold-glow),
      0 0 0 1px rgba(201, 162, 74, 0.55);
  }
  .btn-ghost {
    background: transparent; color: var(--ink-2); border-color: var(--line-2);
  }
  .btn-ghost:hover { color: var(--ink); border-color: var(--ink-3); background: rgba(255,255,255,0.02); }
  .btn-lg { padding: 19px 32px; font-size: 15.5px; }
  .btn .arrow { display: inline-block; transition: transform .2s ease; }
  .btn:hover .arrow { transform: translateX(3px); }

  /* Section base */
  section { position: relative; padding: 120px 0; }
  section + section { border-top: 1px solid var(--line); }
  .section-num {
    font-family: var(--mono); font-size: 11px; color: var(--ink-3);
    letter-spacing: 0.18em; text-transform: uppercase;
  }

  .gold-dot { color: var(--gold); }
  .no-scrollbar::-webkit-scrollbar { display: none; }

  /* Marquee */
  .marquee {
    overflow: hidden; border-block: 1px solid var(--line);
    background: linear-gradient(180deg, var(--bg-2), var(--bg));
    padding: 22px 0; mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
  }
  .marquee-track {
    display: flex; gap: 56px; width: max-content;
    animation: marquee 38s linear infinite;
  }
  .marquee-item {
    display: inline-flex; align-items: center; gap: 12px;
    font-family: var(--serif); font-size: 22px; color: var(--ink-2); font-style: italic;
    white-space: nowrap;
  }
  .marquee-item::after { content: "\\2736"; color: var(--gold); font-style: normal; margin-left: 56px; }
  @keyframes marquee { to { transform: translateX(-50%); } }

  /* Grain texture */
  .grain {
    position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: 0.04;
    background-image: url("data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
    mix-blend-mode: overlay;
  }

  /* Top nav */
  .nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 50;
    padding: 18px 28px; display: flex; align-items: center; justify-content: space-between;
    backdrop-filter: blur(12px) saturate(140%);
    background: linear-gradient(180deg, rgba(10,9,8,0.85), rgba(10,9,8,0.6) 80%, rgba(10,9,8,0));
    border-bottom: 1px solid transparent;
    transition: background .2s ease, border-color .2s ease;
  }
  .nav.scrolled {
    background: rgba(10,9,8,0.86);
    border-bottom-color: var(--line);
  }
  .nav-logo {
    display: flex; align-items: center; gap: 12px;
    font-family: var(--serif); font-size: 19px; letter-spacing: -0.01em;
  }
  .nav-logo img { width: 32px; height: 32px; border-radius: 7px; border: 1px solid var(--line-2); }
  .nav-logo .wordmark em { font-style: italic; color: var(--gold-2); font-weight: 300; }
  .nav-links {
    display: flex; gap: 26px; font-size: 13.5px; color: var(--ink-2);
  }
  .nav-links a:hover { color: var(--gold-2); }
  .nav-cta { display: flex; align-items: center; gap: 14px; }
  @media (max-width: 760px) { .nav-links { display: none; } }

  .center { text-align: center; }
  .muted { color: var(--ink-2); }
  .dim { color: var(--ink-3); }

  :focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; border-radius: 4px; }

  /* Float animation */
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }

  /* Responsividade */
  @media (max-width: 768px) {
    section { padding: 80px 0; }
    .wrap { padding: 0 20px; }
  }
</style>
</head>
<body>
  <div class="grain"></div>
  <div id="root"></div>

  <!-- React + Babel -->
  <script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y" crossorigin="anonymous"></script>

  <script type="text/babel" src="tweaks-panel.jsx"></script>
  <script type="text/babel" src="ui-primitives.jsx"></script>
  <script type="text/babel" src="sections-hero.jsx"></script>
  <script type="text/babel" src="sections-product.jsx"></script>
  <script type="text/babel" src="sections-personas.jsx"></script>
  <script type="text/babel" src="sections-trust.jsx"></script>
  <script type="text/babel" src="sections-cta.jsx"></script>
  <script type="text/babel" src="app.jsx"></script>
</body>
</html>`;

export async function GET() {
  return new Response(LANDING_HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=60',
    },
  });
}
