import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // Static export para Firebase Hosting
  images: {
    unoptimized: true, // Necessário para static export
  },
  // Configurar trailing slash para melhor compatibilidade
  trailingSlash: true,
};

export default nextConfig;
