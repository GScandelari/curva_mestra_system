'use client';

import { AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/services/reportService';
import { separarMaterialParaConsultor, type PrecificacaoProtocolo } from '@/lib/precificacao';

interface ProtocoloPrecificacaoProps {
  precificacao: PrecificacaoProtocolo;
  /** consultor: detalhe só dos itens Rennova, demais agregados (RF-20/RN-17). */
  modo: 'admin' | 'consultor';
  produtosRennova?: Set<string>;
}

function Valor({
  label,
  valor,
  destaque,
}: Readonly<{ label: string; valor: string; destaque?: boolean }>) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={destaque ? 'text-base font-bold' : 'text-sm font-medium'}>{valor}</p>
    </div>
  );
}

function Aviso({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p className="flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-500">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {children}
    </p>
  );
}

export default function ProtocoloPrecificacao({
  precificacao,
  modo,
  produtosRennova = new Set(),
}: Readonly<ProtocoloPrecificacaoProps>) {
  const {
    custoMaterial,
    custoHoraAplicado,
    custoReal,
    precosSugeridos,
    duracaoConsiderada,
    duracaoPadrao,
  } = precificacao;
  const fmt = (v: number | null) => (v === null ? '—' : formatCurrency(v));

  const consultor =
    modo === 'consultor' ? separarMaterialParaConsultor(custoMaterial, produtosRennova) : null;
  const nomesPorCodigo = new Map(
    custoMaterial.itens.map((i) => [i.codigo_produto, i.nome_produto])
  );

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <Valor
          label="Duração"
          valor={`${duracaoConsiderada} min${duracaoPadrao ? ' (padrão)' : ''}`}
        />
        <Valor label="Material" valor={formatCurrency(custoMaterial.total)} />
        <Valor label="Hora clínica" valor={fmt(custoHoraAplicado)} />
        <Valor label="Custo real" valor={fmt(custoReal)} />
        <Valor label="Preço Pix/Dinheiro" valor={fmt(precosSugeridos.pix_dinheiro)} destaque />
        <Valor label="Preço Crédito" valor={fmt(precosSugeridos.credito)} destaque />
      </div>

      {consultor && (consultor.itensRennova.length > 0 || consultor.outrosMateriais) && (
        <div className="space-y-1 border-t pt-2 text-sm">
          {consultor.itensRennova.map((item) => (
            <div key={item.codigo_produto} className="flex justify-between gap-2">
              <span>
                {item.nome_produto} × {item.quantidade}
              </span>
              <span className="text-muted-foreground">{fmt(item.subtotal)}</span>
            </div>
          ))}
          {consultor.outrosMateriais && (
            <div className="flex justify-between gap-2">
              <span>Outros materiais ({consultor.outrosMateriais.quantidadeItens})</span>
              <span className="text-muted-foreground">
                {formatCurrency(consultor.outrosMateriais.subtotal)}
              </span>
            </div>
          )}
        </div>
      )}

      {duracaoPadrao && <Aviso>Duração não informada — considerada 1 hora</Aviso>}
      {modo === 'admin' && custoMaterial.incompleto && (
        <Aviso>
          Custo de material incompleto: sem valor para{' '}
          {custoMaterial.codigosSemCusto.map((c) => nomesPorCodigo.get(c) ?? c).join(', ')}
        </Aviso>
      )}
      {consultor && consultor.incompletoRennova.length > 0 && (
        <Aviso>
          Custo de material incompleto: sem valor para{' '}
          {consultor.incompletoRennova.map((c) => nomesPorCodigo.get(c) ?? c).join(', ')}
        </Aviso>
      )}
      {consultor?.outrosMateriais?.incompleto && <Aviso>Outros materiais: custo incompleto</Aviso>}
    </div>
  );
}
