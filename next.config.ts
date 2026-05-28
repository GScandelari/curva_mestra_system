import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Configuração para Next.js com Firebase Hosting
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return {
      // beforeFiles: roda antes da verificação de páginas Next.js e arquivos públicos.
      // Reescreve a raiz para /landing sem alterar a URL do browser.
      // O Firebase Hosting serve public/landing/index.html em /landing/;
      // com <base href="/landing/"> no HTML, todos os assets JSX resolvem corretamente.
      beforeFiles: [{ source: '/', destination: '/landing' }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
