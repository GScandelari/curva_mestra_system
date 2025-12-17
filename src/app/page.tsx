"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

export default function Home() {
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    // Data de lançamento: 01/02/2026
    const launchDate = new Date("2026-02-01T00:00:00").getTime();

    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = launchDate - now;

      if (distance > 0) {
        setCountdown({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000),
        });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num: number) => String(num).padStart(2, "0");

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d] text-white">
      {/* Botão de Login fixo no topo direito */}
      <div className="fixed top-4 right-4 md:top-6 md:right-6 z-50">
        <Link href="/login">
          <Button
            size="lg"
            className="bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black hover:from-[#D4AF37] hover:to-[#FFD700] font-semibold shadow-lg shadow-[#D4AF37]/50 transition-all"
          >
            <LogIn className="mr-2 h-4 w-4 md:h-5 md:w-5" />
            <span className="hidden sm:inline">Acessar Sistema</span>
            <span className="sm:hidden">Acessar</span>
          </Button>
        </Link>
      </div>

      <div className="container flex flex-col items-center justify-center min-h-screen px-6 py-12 gap-12">
        {/* Header */}
        <header className="text-center mb-4">
          <div className="mb-6">
            <Image
              src="/logo.svg"
              alt="Logo Curva Mestra"
              width={200}
              height={200}
              className="mx-auto drop-shadow-[0_0_20px_rgba(212,175,55,0.3)]"
              priority
            />
          </div>
          <h1 className="font-serif text-5xl md:text-6xl font-bold mb-3 bg-gradient-to-r from-[#FFD700] to-[#D4AF37] bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(212,175,55,0.3)]">
            Curva Mestra
          </h1>
          <h2 className="text-xl md:text-2xl font-light text-[#FFD700] tracking-wide mb-2">
            Sistema de Gestão de Injetáveis de Harmonização
          </h2>
          <p className="text-lg md:text-xl font-light text-[#D4AF37] tracking-widest uppercase">
            Sistema em Construção
          </p>
        </header>

        {/* Countdown */}
        <div className="w-full max-w-4xl">
          <p className="text-xl md:text-2xl font-light text-[#D4AF37] text-center mb-6 tracking-widest uppercase">
            Tempo até o lançamento
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
              { value: countdown.days, label: "Dias" },
              { value: countdown.hours, label: "Horas" },
              { value: countdown.minutes, label: "Minutos" },
              { value: countdown.seconds, label: "Segundos" },
            ].map((item, index) => (
              <div
                key={index}
                className="flex flex-col items-center justify-center p-6 bg-[#2d2d2d]/50 border-2 border-[#D4AF37] rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.5)] backdrop-blur-sm"
              >
                <span className="font-mono text-4xl md:text-5xl font-bold text-[#FFD700] mb-2 drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">
                  {formatNumber(item.value)}
                </span>
                <span className="text-sm font-light text-white/80 uppercase tracking-widest">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Info Section */}
        <section className="w-full max-width-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {/* Card 1 - Funcionalidades */}
            <div className="flex flex-col items-center p-8 bg-[#2d2d2d]/50 border-2 border-[#D4AF37] rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.5)] backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-[#FFD700] mb-4 uppercase tracking-wide">
                Funcionalidades
              </h3>
              <ul className="space-y-3 w-full">
                {[
                  "Controle de Estoque",
                  "Gestão de Lotes",
                  "Rastreamento de Validade",
                  "Relatórios Detalhados",
                  "Sistema Multi-Tenant",
                ].map((feature, index) => (
                  <li
                    key={index}
                    className="text-white/90 font-light text-base leading-relaxed pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-[#D4AF37] before:font-bold"
                  >
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 2 - Benefícios */}
            <div className="flex flex-col items-center p-8 bg-[#2d2d2d]/50 border-2 border-[#D4AF37] rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.5)] backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-[#FFD700] mb-4 uppercase tracking-wide">
                Benefícios
              </h3>
              <ul className="space-y-3 w-full">
                {[
                  "Redução de Desperdício",
                  "Maior Eficiência",
                  "Conformidade Legal",
                  "Decisões Baseadas em Dados",
                  "Interface Intuitiva",
                ].map((benefit, index) => (
                  <li
                    key={index}
                    className="text-white/90 font-light text-base leading-relaxed pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-[#D4AF37] before:font-bold"
                  >
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 3 - Planos */}
            <div className="flex flex-col items-center p-8 bg-[#2d2d2d]/50 border-2 border-[#D4AF37] rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.5)] backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-[#FFD700] mb-4 uppercase tracking-wide">
                Planos Iniciais
              </h3>
              <div className="space-y-6 w-full">
                <div className="text-center border-b border-[#D4AF37]/30 pb-4">
                  <p className="text-white/90 font-light mb-3 text-lg">Plano Semestral</p>
                  <div className="flex items-baseline justify-center gap-1 mb-2">
                    <strong className="text-[#FFD700] font-semibold text-3xl">
                      R$ 59,90
                    </strong>
                    <span className="text-white/70 text-sm">/mês</span>
                  </div>
                  <p className="text-white/60 text-sm">
                    Pagamento mensal da licença
                  </p>
                  <p className="text-white/50 text-xs mt-1">
                    (6 meses de compromisso)
                  </p>
                </div>
                <div className="text-center pb-4">
                  <p className="text-white/90 font-light mb-3 text-lg">Plano Anual</p>
                  <div className="flex items-baseline justify-center gap-1 mb-2">
                    <strong className="text-[#FFD700] font-semibold text-3xl">
                      R$ 49,90
                    </strong>
                    <span className="text-white/70 text-sm">/mês</span>
                  </div>
                  <p className="text-white/60 text-sm">
                    Pagamento mensal da licença
                  </p>
                  <p className="text-white/50 text-xs mt-1">
                    (12 meses de compromisso)
                  </p>
                  <div className="mt-2">
                    <span className="inline-block px-3 py-1 bg-green-600/20 text-green-400 text-xs rounded-full border border-green-600/30">
                      Economize R$ 120,00/ano
                    </span>
                  </div>
                </div>
                <p className="text-sm text-white/70 text-center mt-2 pt-4 border-t border-[#D4AF37]/30">
                  Preços promocionais de lançamento
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Early Access Section */}
        <section className="w-full max-w-4xl mt-12">
          <div className="relative overflow-hidden">
            {/* Background glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#FFD700]/10 via-[#D4AF37]/10 to-[#FFD700]/10 blur-3xl"></div>

            <div className="relative bg-[#2d2d2d]/80 border-2 border-[#D4AF37] rounded-2xl shadow-[0_0_30px_rgba(212,175,55,0.6)] backdrop-blur-sm p-10 md:p-12">
              <div className="text-center space-y-6">
                <div className="inline-block px-4 py-1 bg-[#FFD700]/20 border border-[#FFD700]/50 rounded-full">
                  <span className="text-[#FFD700] text-sm font-semibold uppercase tracking-wider">
                    Acesso Antecipado
                  </span>
                </div>

                <h3 className="text-3xl md:text-4xl font-bold text-white">
                  Seja um dos Primeiros!
                </h3>

                <p className="text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
                  Garanta seu acesso antecipado ao <span className="text-[#FFD700] font-semibold">Curva Mestra</span> e
                  aproveite <span className="text-[#FFD700] font-semibold">condições especiais</span> de lançamento para
                  clínicas e profissionais autônomos.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                  <Link href="/register">
                    <Button
                      size="lg"
                      className="bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black hover:from-[#D4AF37] hover:to-[#FFD700] font-bold text-lg px-8 py-6 shadow-xl shadow-[#D4AF37]/50 transition-all hover:scale-105 w-full sm:w-auto"
                    >
                      Solicitar Acesso Antecipado
                    </Button>
                  </Link>
                </div>

                <div className="flex items-center justify-center gap-8 pt-6 text-sm text-white/60">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Sem custo de adesão</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Configuração facilitada</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social Links */}
        <footer className="text-center mt-8">
          <p className="text-[#D4AF37] text-lg mb-4">
            Siga-nos no Instagram para novidades
          </p>
          <a
            href="https://instagram.com/curvamestra"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3 bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black font-semibold rounded-lg hover:from-[#D4AF37] hover:to-[#FFD700] transition-all shadow-lg shadow-[#D4AF37]/50"
          >
            @curvamestra
          </a>
        </footer>
      </div>
    </main>
  );
}
