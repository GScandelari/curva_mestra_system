import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuração para Next.js com Firebase
  // Removido output: "export" porque temos páginas dinâmicas [id]
  // Para produção, usar Firebase Functions com Next.js standalone

  images: {
    unoptimized: true,
  },
};

export default nextConfig;
