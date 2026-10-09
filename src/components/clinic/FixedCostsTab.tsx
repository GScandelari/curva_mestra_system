'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLinkedConsultant } from '@/hooks/useLinkedConsultant';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Save, Share2 } from 'lucide-react';
import CustoHoraResumo from '@/components/pricing/CustoHoraResumo';
import {
  CUSTOS_FIXOS_BASE,
  DIAS_SEMANA,
  calcularHorasDia,
  calcularParcelasPagasNoMes,
  calcularParcelasRestantes,
  calcularResumoCustoHora,
  criarConfigPadrao,
  extrairConfigInput,
  mesCorrenteSaoPaulo,
  validarCustoHoraConfig,
} from '@/lib/precificacao';
import {
  getCustoHoraConfig,
  saveCustoHoraConfig,
  type CustoHoraConfigInput,
} from '@/lib/services/custoHoraService';
import { formatCurrency } from '@/lib/services/reportService';
import { translateFirestoreError } from '@/lib/firestoreErrors';
import type {
  BoletoTec,
  CustoHoraConfig,
  DiaSemanaKey,
  DisponibilidadeDia,
  ParametrosMarkup,
} from '@/types';

function parseNumero(valor: string): number {
  if (valor.trim() === '') return 0;
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function MoneyInput({
  value,
  onChange,
  id,
  ariaLabel,
}: Readonly<{
  value: number;
  onChange: (v: number) => void;
  id?: string;
  ariaLabel?: string;
}>) {
  return (
    <Input
      id={id}
      aria-label={ariaLabel}
      type="number"
      min={0}
      step="0.01"
      inputMode="decimal"
      placeholder="0,00"
      value={value === 0 ? '' : value}
      onChange={(e) => onChange(parseNumero(e.target.value))}
    />
  );
}

const MARKUP_CAMPOS: { key: keyof ParametrosMarkup; label: string }[] = [
  { key: 'imposto_pct', label: 'Imposto (%)' },
  { key: 'cartao_pct', label: 'Taxa de cartão (%)' },
  { key: 'comissao_pct', label: 'Comissão (%)' },
  { key: 'margem_pct', label: 'Margem desejada (%)' },
];

export default function FixedCostsTab() {
  const { user, claims } = useAuth();
  const tenantId = claims?.tenant_id;
  const { toast } = useToast();
  const { consultant, loading: consultantLoading, error: consultantError } = useLinkedConsultant();

  const mesAtual = useMemo(() => mesCorrenteSaoPaulo(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<CustoHoraConfig | null>(null);
  const [form, setForm] = useState<CustoHoraConfigInput | null>(null);
  const [trocaDeConsultor, setTrocaDeConsultor] = useState(false);
  const [rn16Avaliada, setRn16Avaliada] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    async function load() {
      setLoading(true);
      try {
        const config = await getCustoHoraConfig(tenantId!);
        setExisting(config);
        setForm(extrairConfigInput(config ?? criarConfigPadrao(tenantId!)));
      } catch (error) {
        console.error('Erro ao carregar custos fixos:', error);
        toast({
          title: 'Erro ao carregar',
          description: translateFirestoreError((error as { code?: string })?.code),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    load().catch((error) => console.error('Erro ao carregar custos fixos:', error));
  }, [tenantId, toast]);

  // RN-16: compartilhamento gravado para um consultor que não é mais o vinculado.
  // Se a busca do consultor falhou, não dá para afirmar que ele mudou.
  useEffect(() => {
    if (!form || consultantLoading || consultantError || rn16Avaliada) return;
    setRn16Avaliada(true);
    if (
      form.compartilhar_com_consultor &&
      form.compartilhado_com_consultant_id !== (consultant?.id ?? null)
    ) {
      setTrocaDeConsultor(true);
      setForm({
        ...form,
        compartilhar_com_consultor: false,
        compartilhado_com_consultant_id: null,
      });
    }
  }, [form, consultant, consultantLoading, consultantError, rn16Avaliada]);

  const resumo = useMemo(
    () =>
      form && tenantId ? calcularResumoCustoHora({ ...form, tenant_id: tenantId }, mesAtual) : null,
    [form, tenantId, mesAtual]
  );

  const erros = useMemo(() => (form ? validarCustoHoraConfig(form) : null), [form]);

  if (loading || !form || !resumo || !erros) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const update = (patch: Partial<CustoHoraConfigInput>) => setForm({ ...form, ...patch });

  const updateDia = (key: DiaSemanaKey, dia: DisponibilidadeDia) =>
    update({ disponibilidade: { ...form.disponibilidade, [key]: dia } });

  const updateBoleto = (id: string, patch: Partial<BoletoTec>) =>
    update({ boletos_tec: form.boletos_tec.map((b) => (b.id === id ? { ...b, ...patch } : b)) });

  const somaMarkup =
    form.markup.imposto_pct +
    form.markup.cartao_pct +
    form.markup.comissao_pct +
    form.markup.margem_pct;

  let textoCompartilhamento = 'Nenhum consultor vinculado.';
  if (consultant) {
    const prefixo = form.compartilhar_com_consultor
      ? `Compartilhado com ${consultant.name}.`
      : `Consultor vinculado: ${consultant.name}.`;
    textoCompartilhamento = `${prefixo} Esta ação fica registrada na trilha de auditoria.`;
  }

  const handleSave = async () => {
    if (!tenantId || !user || erros.total > 0) return;
    setSaving(true);
    try {
      const saved = await saveCustoHoraConfig(
        tenantId,
        user.uid,
        user.displayName || user.email || user.uid,
        form,
        existing,
        { consultantName: consultant?.name, trocaDeConsultor }
      );
      setExisting(saved);
      setForm(extrairConfigInput(saved));
      setTrocaDeConsultor(false);
      toast({ title: 'Custos salvos com sucesso' });
    } catch (error) {
      console.error('Erro ao salvar custos fixos:', error);
      toast({
        title: 'Erro ao salvar',
        description: translateFirestoreError((error as { code?: string })?.code),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <CustoHoraResumo resumo={resumo} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Custos fixos mensais</CardTitle>
          <CardDescription>
            Valores mensais em R$. Deixe em branco o que não se aplica.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CUSTOS_FIXOS_BASE.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`custo-${key}`}>{label}</Label>
                <MoneyInput
                  id={`custo-${key}`}
                  value={form.custos_fixos_base[key]}
                  onChange={(v) =>
                    update({ custos_fixos_base: { ...form.custos_fixos_base, [key]: v } })
                  }
                />
              </div>
            ))}
          </div>
          {erros.base && <p className="text-sm text-destructive">{erros.base}</p>}

          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">Outros custos fixos</p>
            {form.custos_fixos_personalizados.map((item) => (
              <div key={item.id} className="space-y-1">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    aria-label="Nome do custo"
                    placeholder="Nome do custo"
                    maxLength={60}
                    value={item.nome}
                    onChange={(e) =>
                      update({
                        custos_fixos_personalizados: form.custos_fixos_personalizados.map((c) =>
                          c.id === item.id ? { ...c, nome: e.target.value } : c
                        ),
                      })
                    }
                  />
                  <div className="flex gap-2">
                    <MoneyInput
                      ariaLabel="Valor do custo"
                      value={item.valor}
                      onChange={(v) =>
                        update({
                          custos_fixos_personalizados: form.custos_fixos_personalizados.map((c) =>
                            c.id === item.id ? { ...c, valor: v } : c
                          ),
                        })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover custo"
                      onClick={() =>
                        update({
                          custos_fixos_personalizados: form.custos_fixos_personalizados.filter(
                            (c) => c.id !== item.id
                          ),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {erros.personalizados[item.id] && (
                  <p className="text-sm text-destructive">{erros.personalizados[item.id]}</p>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                update({
                  custos_fixos_personalizados: [
                    ...form.custos_fixos_personalizados,
                    { id: crypto.randomUUID(), nome: '', valor: 0 },
                  ],
                })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar custo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Boleto Tec</CardTitle>
          <CardDescription>
            Financiamento de equipamento/tecnologia. A parcela compõe o custo enquanto houver
            parcelas restantes; as parcelas pagas avançam automaticamente a cada mês.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.boletos_tec.map((boleto) => {
            const restantes = calcularParcelasRestantes(boleto, mesAtual);
            return (
              <div key={boleto.id} className="space-y-2 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  {restantes > 0 ? (
                    <Badge variant="secondary">Compõe o custo · {restantes} restantes</Badge>
                  ) : (
                    <Badge variant="outline">Quitado</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remover boleto"
                    onClick={() =>
                      update({ boletos_tec: form.boletos_tec.filter((b) => b.id !== boleto.id) })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <Label htmlFor={`boleto-desc-${boleto.id}`}>Descrição</Label>
                    <Input
                      id={`boleto-desc-${boleto.id}`}
                      placeholder="Ex: Laser"
                      value={boleto.descricao}
                      onChange={(e) => updateBoleto(boleto.id, { descricao: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`boleto-valor-${boleto.id}`}>Valor da parcela</Label>
                    <MoneyInput
                      id={`boleto-valor-${boleto.id}`}
                      value={boleto.valor_parcela}
                      onChange={(v) => updateBoleto(boleto.id, { valor_parcela: v })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`boleto-total-${boleto.id}`}>Total de parcelas</Label>
                    <Input
                      id={`boleto-total-${boleto.id}`}
                      type="number"
                      min={1}
                      step={1}
                      value={boleto.total_parcelas}
                      onChange={(e) =>
                        updateBoleto(boleto.id, { total_parcelas: parseNumero(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`boleto-pagas-${boleto.id}`}>Parcelas já pagas</Label>
                    <Input
                      id={`boleto-pagas-${boleto.id}`}
                      type="number"
                      min={0}
                      step={1}
                      value={calcularParcelasPagasNoMes(boleto, mesAtual)}
                      onChange={(e) =>
                        updateBoleto(boleto.id, {
                          parcelas_pagas: parseNumero(e.target.value),
                          mes_referencia: mesAtual,
                        })
                      }
                    />
                  </div>
                </div>
                {erros.boletos[boleto.id] && (
                  <p className="text-sm text-destructive">{erros.boletos[boleto.id]}</p>
                )}
              </div>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              update({
                boletos_tec: [
                  ...form.boletos_tec,
                  {
                    id: crypto.randomUUID(),
                    descricao: '',
                    valor_parcela: 0,
                    total_parcelas: 1,
                    parcelas_pagas: 0,
                    mes_referencia: mesAtual,
                  },
                ],
              })
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Boleto Tec
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Disponibilidade semanal</CardTitle>
          <CardDescription>
            Dias e horários de atendimento. As horas do mês contam os dias reais do mês corrente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DIAS_SEMANA.map(({ key, label }) => {
            const dia = form.disponibilidade[key];
            return (
              <div key={key} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Switch
                      id={`dia-${key}`}
                      checked={dia.ativo}
                      onCheckedChange={(ativo) =>
                        updateDia(key, {
                          ativo,
                          periodos:
                            ativo && dia.periodos.length === 0
                              ? [{ inicio: '08:00', fim: '12:00' }]
                              : dia.periodos,
                        })
                      }
                    />
                    <Label htmlFor={`dia-${key}`}>{label}</Label>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {calcularHorasDia(dia).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h
                  </span>
                </div>
                {dia.ativo && (
                  <div className="space-y-2">
                    {dia.periodos.map((periodo, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          type="time"
                          aria-label={`${label} início do período ${index + 1}`}
                          className="w-32"
                          value={periodo.inicio}
                          onChange={(e) =>
                            updateDia(key, {
                              ...dia,
                              periodos: dia.periodos.map((p, i) =>
                                i === index ? { ...p, inicio: e.target.value } : p
                              ),
                            })
                          }
                        />
                        <span className="text-sm text-muted-foreground">até</span>
                        <Input
                          type="time"
                          aria-label={`${label} fim do período ${index + 1}`}
                          className="w-32"
                          value={periodo.fim}
                          onChange={(e) =>
                            updateDia(key, {
                              ...dia,
                              periodos: dia.periodos.map((p, i) =>
                                i === index ? { ...p, fim: e.target.value } : p
                              ),
                            })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remover período"
                          onClick={() =>
                            updateDia(key, {
                              ...dia,
                              periodos: dia.periodos.filter((_, i) => i !== index),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateDia(key, {
                          ...dia,
                          periodos: [...dia.periodos, { inicio: '13:00', fim: '17:00' }],
                        })
                      }
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Período
                    </Button>
                    {erros.dias[key] && (
                      <p className="text-sm text-destructive">{erros.dias[key]}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Capacidade</CardTitle>
            <CardDescription>
              Atendimentos simultâneos = o menor valor entre salas e profissionais.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="salas">Salas</Label>
                <Input
                  id="salas"
                  type="number"
                  min={1}
                  step={1}
                  value={form.quantidade_salas}
                  onChange={(e) => update({ quantidade_salas: parseNumero(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="profissionais">Profissionais simultâneos</Label>
                <Input
                  id="profissionais"
                  type="number"
                  min={1}
                  step={1}
                  value={form.quantidade_profissionais}
                  onChange={(e) =>
                    update({ quantidade_profissionais: parseNumero(e.target.value) })
                  }
                />
              </div>
            </div>
            {erros.capacidade && <p className="text-sm text-destructive">{erros.capacidade}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Markup</CardTitle>
            <CardDescription>
              Preço sugerido = custo real ÷ (1 − soma dos percentuais). Soma atual:{' '}
              {somaMarkup.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {MARKUP_CAMPOS.map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`markup-${key}`}>{label}</Label>
                  <Input
                    id={`markup-${key}`}
                    type="number"
                    min={0}
                    max={99.99}
                    step="0.01"
                    placeholder="0"
                    value={form.markup[key] === 0 ? '' : form.markup[key]}
                    onChange={(e) =>
                      update({ markup: { ...form.markup, [key]: parseNumero(e.target.value) } })
                    }
                  />
                </div>
              ))}
            </div>
            {erros.markup && <p className="text-sm text-destructive">{erros.markup}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Compartilhamento com o consultor
          </CardTitle>
          <CardDescription>
            Permite que o consultor vinculado veja, somente leitura, os custos e a precificação dos
            protocolos para planos estratégicos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {trocaDeConsultor && (
            <Alert variant="warning">
              <AlertDescription>
                O compartilhamento anterior não vale para o consultor atual. Salve para registrar a
                revogação ou ative novamente para compartilhar com o novo consultor.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex items-center gap-3">
            <Switch
              id="compartilhar"
              disabled={!consultant}
              checked={form.compartilhar_com_consultor}
              onCheckedChange={(checked) =>
                update({
                  compartilhar_com_consultor: checked,
                  compartilhado_com_consultant_id: checked ? (consultant?.id ?? null) : null,
                })
              }
            />
            <Label htmlFor="compartilhar">Compartilhar dados financeiros com o consultor</Label>
          </div>
          <p className="text-sm text-muted-foreground">{textoCompartilhamento}</p>
        </CardContent>
      </Card>

      <div className="flex flex-col items-end gap-2">
        {erros.total > 0 && (
          <p className="text-sm text-destructive">Corrija os campos destacados para salvar.</p>
        )}
        <Button onClick={handleSave} disabled={saving || erros.total > 0}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Total de custos fixos considerados: {formatCurrency(resumo.custoFixo.total)}
        </p>
      </div>
    </div>
  );
}
