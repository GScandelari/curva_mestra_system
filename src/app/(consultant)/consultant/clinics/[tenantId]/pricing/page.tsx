'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Calculator, Lock } from 'lucide-react';
import { ReadOnlyBanner } from '@/components/consultant/ReadOnlyBanner';
import CustoHoraResumo from '@/components/pricing/CustoHoraResumo';
import ProtocoloPrecificacao from '@/components/pricing/ProtocoloPrecificacao';
import { getCustoHoraConfig, listInventoryForCosting } from '@/lib/services/custoHoraService';
import { listProtocolos } from '@/lib/services/protocoloService';
import { formatCurrency } from '@/lib/services/reportService';
import {
  CUSTOS_FIXOS_BASE,
  calcularCustoMaterialProtocolo,
  calcularCustoMedioPorProduto,
  calcularParcelasRestantes,
  calcularPrecificacaoProtocolo,
  calcularProdutosRennova,
  calcularResumoCustoHora,
  mesCorrenteSaoPaulo,
  type LoteParaCusto,
} from '@/lib/precificacao';
import type { CustoHoraConfig, Protocolo } from '@/types';

/**
 * Precificação da clínica, somente leitura, para o consultor vinculado
 * (RF-16/RF-20). Só abre com o opt-in financeiro do clinic_admin para este
 * consultor — as rules negam a leitura de `financeiro` caso contrário.
 */
export default function ConsultantPricingPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.tenantId as string;
  const { authorizedTenants, loading: authLoading, claims } = useAuth();

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<CustoHoraConfig | null>(null);
  const [protocolos, setProtocolos] = useState<Protocolo[]>([]);
  const [lotes, setLotes] = useState<LoteParaCusto[]>([]);

  const autorizado = !!claims && authorizedTenants.includes(tenantId);

  useEffect(() => {
    if (authLoading) return;
    if (claims && !authorizedTenants.includes(tenantId)) {
      router.push('/consultant/clinics');
    }
  }, [tenantId, authorizedTenants, authLoading, claims, router]);

  useEffect(() => {
    if (authLoading || !autorizado) return;

    async function load() {
      setLoading(true);
      try {
        const custo = await getCustoHoraConfig(tenantId);
        if (!custo) return;
        const [lista, inventario] = await Promise.all([
          listProtocolos(tenantId),
          listInventoryForCosting(tenantId),
        ]);
        setConfig(custo);
        setProtocolos(lista);
        setLotes(inventario);
      } catch (error) {
        // permission-denied = clínica não compartilhou com este consultor
        console.error('Precificação indisponível para o consultor:', error);
        setConfig(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tenantId, autorizado, authLoading]);

  const mesAtual = useMemo(() => mesCorrenteSaoPaulo(), []);
  const resumo = useMemo(
    () => (config ? calcularResumoCustoHora(config, mesAtual) : null),
    [config, mesAtual]
  );
  const custosMedios = useMemo(() => calcularCustoMedioPorProduto(lotes), [lotes]);
  const produtosRennova = useMemo(() => calcularProdutosRennova(lotes), [lotes]);

  const header = (
    <div>
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => router.push(`/consultant/clinics/${tenantId}`)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>
      <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
        <Calculator className="h-8 w-8 text-sky-600" />
        Precificação
      </h1>
      <p className="text-muted-foreground">
        Custo da hora clínica e preço sugerido dos protocolos da clínica
      </p>
    </div>
  );

  if (authLoading || loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
        </div>
      </div>
    );
  }

  if (!config || !resumo) {
    return (
      <div className="container py-8">
        <div className="space-y-6">
          {header}
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <Lock className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                Esta clínica não compartilhou dados financeiros com você.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const boletosAtivos = config.boletos_tec.filter(
    (b) => calcularParcelasRestantes(b, mesAtual) > 0
  );

  return (
    <div className="container py-8">
      <div className="space-y-6">
        {header}
        <ReadOnlyBanner />
        <CustoHoraResumo resumo={resumo} />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Custos fixos mensais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {CUSTOS_FIXOS_BASE.filter(({ key }) => config.custos_fixos_base[key] > 0).map(
                ({ key, label }) => (
                  <div key={key} className="flex justify-between gap-2">
                    <span>{label}</span>
                    <span>{formatCurrency(config.custos_fixos_base[key])}</span>
                  </div>
                )
              )}
              {config.custos_fixos_personalizados.map((item) => (
                <div key={item.id} className="flex justify-between gap-2">
                  <span>{item.nome}</span>
                  <span>{formatCurrency(item.valor)}</span>
                </div>
              ))}
              {boletosAtivos.map((boleto) => (
                <div key={boleto.id} className="flex justify-between gap-2">
                  <span>
                    Boleto Tec: {boleto.descricao} ({calcularParcelasRestantes(boleto, mesAtual)}{' '}
                    restantes)
                  </span>
                  <span>{formatCurrency(boleto.valor_parcela)}</span>
                </div>
              ))}
              <div className="flex justify-between gap-2 border-t pt-2 font-semibold">
                <span>Total</span>
                <span>{formatCurrency(resumo.custoFixo.total)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Markup</CardTitle>
              <CardDescription>Percentuais usados no preço sugerido</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {[
                ['Imposto', config.markup.imposto_pct],
                ['Taxa de cartão', config.markup.cartao_pct],
                ['Comissão', config.markup.comissao_pct],
                ['Margem desejada', config.markup.margem_pct],
              ].map(([label, valor]) => (
                <div key={label} className="flex justify-between gap-2">
                  <span>{label}</span>
                  <span>{Number(valor).toLocaleString('pt-BR')}%</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Protocolos</CardTitle>
            <CardDescription>
              Materiais de outras marcas aparecem agrupados em &quot;Outros materiais&quot;; os
              totais incluem todos os itens.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {protocolos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum protocolo cadastrado.</p>
            ) : (
              protocolos.map((protocolo) => (
                <div key={protocolo.id} className="space-y-2">
                  <p className="font-medium">{protocolo.nome}</p>
                  <ProtocoloPrecificacao
                    modo="consultor"
                    produtosRennova={produtosRennova}
                    duracaoMinutos={protocolo.duracao_minutos}
                    precificacao={calcularPrecificacaoProtocolo({
                      duracaoMinutos: protocolo.duracao_minutos,
                      custoHora: resumo.custoHora,
                      divisor: resumo.divisor,
                      custoMaterial: calcularCustoMaterialProtocolo(protocolo.itens, custosMedios),
                    })}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
