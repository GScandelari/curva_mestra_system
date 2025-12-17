"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  User,
  Package,
  AlertTriangle,
  Check,
  X,
  Trash2,
  Plus,
} from "lucide-react";
import { listInventory, type InventoryItem } from "@/lib/services/inventoryService";
import {
  createSolicitacaoWithConsumption,
  updateSolicitacaoAgendada,
  type CreateSolicitacaoInput,
} from "@/lib/services/solicitacaoService";
import { searchPatients } from "@/lib/services/patientService";
import type { Patient } from "@/types/patient";

type Step = "dados_paciente" | "adicionar_produtos" | "revisao";

interface ProdutoSelecionado {
  inventory_item_id: string;
  produto_codigo: string;
  produto_nome: string;
  lote: string;
  quantidade_solicitada: number;
  quantidade_disponivel: number;
  valor_unitario: number;
}

// Interface para produto agrupado (soma de todos os lotes)
interface ProdutoAgrupado {
  codigo_produto: string;
  nome_produto: string;
  quantidade_total: number;
  lotes: InventoryItem[]; // Ordenados por validade (FEFO)
}

export default function NovaSolicitacaoPage() {
  const { user, claims } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const tenantId = claims?.tenant_id;

  // Verificar permissão - apenas clinic_admin pode criar procedimentos
  useEffect(() => {
    if (claims && claims.role !== "clinic_admin") {
      router.push("/clinic/requests");
    }
  }, [claims, router]);

  // Modo de edição
  const editId = searchParams.get("edit");
  const isEditMode = !!editId;

  // Pegar parâmetros da URL para pré-preenchimento
  const patientCodeParam = searchParams.get("patientCode") || searchParams.get("pacienteCodigo");
  const patientNameParam = searchParams.get("patientName") || searchParams.get("pacienteNome");

  // Estados do formulário
  const [step, setStep] = useState<Step>("dados_paciente");
  const [codigoPaciente, setCodigoPaciente] = useState(patientCodeParam || "");
  const [nomePaciente, setNomePaciente] = useState(patientNameParam || "");
  const [dtProcedimento, setDtProcedimento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Estados do autocomplete
  const [patientSearchTerm, setPatientSearchTerm] = useState("");
  const [patientSearchFilter, setPatientSearchFilter] = useState<"all" | "codigo" | "nome" | "telefone">("all");
  const [patientSuggestions, setPatientSuggestions] = useState<Patient[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingPatients, setSearchingPatients] = useState(false);

  // Estados de produtos
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [produtosAgrupados, setProdutosAgrupados] = useState<ProdutoAgrupado[]>([]);
  const [produtosSelecionados, setProdutosSelecionados] = useState<ProdutoSelecionado[]>([]);
  const [selectedProductCode, setSelectedProductCode] = useState(""); // Mudou de ID para CODE
  const [quantidadeSolicitada, setQuantidadeSolicitada] = useState("1");

  // Estados de loading e erro
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Debounce para busca de pacientes
  useEffect(() => {
    if (!patientSearchTerm || patientSearchTerm.length < 2) {
      setPatientSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const delaySearch = setTimeout(async () => {
      if (!tenantId) return;

      try {
        setSearchingPatients(true);
        const results = await searchPatients(tenantId, patientSearchTerm, 8, patientSearchFilter);
        setPatientSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (error) {
        console.error("Erro ao buscar pacientes:", error);
        setPatientSuggestions([]);
      } finally {
        setSearchingPatients(false);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [patientSearchTerm, patientSearchFilter, tenantId]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('#patient-search-container')) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Função para selecionar paciente do autocomplete
  const handleSelectPatient = (patient: Patient) => {
    setCodigoPaciente(patient.codigo);
    setNomePaciente(patient.nome);
    setPatientSearchTerm("");
    setShowSuggestions(false);
    setPatientSuggestions([]);
  };

  // Função para agrupar produtos por código e ordenar lotes por FEFO
  const agruparProdutosPorCodigo = (items: any[]): ProdutoAgrupado[] => {
    const gruposPorCodigo = new Map<string, InventoryItem[]>();

    // Agrupar por código
    items.forEach((item) => {
      const codigo = item.codigo_produto;
      if (!gruposPorCodigo.has(codigo)) {
        gruposPorCodigo.set(codigo, []);
      }
      gruposPorCodigo.get(codigo)!.push(item);
    });

    // Transformar em array e ordenar lotes por validade (FEFO)
    const produtosAgrupados: ProdutoAgrupado[] = [];

    gruposPorCodigo.forEach((lotes, codigo) => {
      // Ordenar lotes por data de validade (mais próximo primeiro)
      const lotesOrdenados = lotes.sort((a, b) => {
        const dataA = new Date(a.dt_validade).getTime();
        const dataB = new Date(b.dt_validade).getTime();
        return dataA - dataB; // Crescente = mais próximo primeiro
      });

      // Calcular quantidade total
      const quantidadeTotal = lotesOrdenados.reduce(
        (sum, lote) => sum + lote.quantidade_disponivel,
        0
      );

      produtosAgrupados.push({
        codigo_produto: codigo,
        nome_produto: lotesOrdenados[0].nome_produto,
        quantidade_total: quantidadeTotal,
        lotes: lotesOrdenados,
      });
    });

    // Ordenar produtos por nome
    return produtosAgrupados.sort((a, b) =>
      a.nome_produto.localeCompare(b.nome_produto)
    );
  };

  // Carregar inventário ao iniciar
  useEffect(() => {
    async function loadInventory() {
      if (!tenantId) return;

      try {
        setLoading(true);
        const items = await listInventory(tenantId);

        // Filtrar apenas produtos com estoque disponível
        const availableItems = items.filter(
          (item) => item.active && item.quantidade_disponivel > 0
        );

        setInventoryItems(availableItems);

        // Agrupar produtos por código
        const agrupados = agruparProdutosPorCodigo(availableItems);
        setProdutosAgrupados(agrupados);
      } catch (err: any) {
        console.error("Erro ao carregar inventário:", err);
        toast({
          title: "Erro ao carregar inventário",
          description: "Não foi possível carregar os produtos disponíveis",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    loadInventory();
  }, [tenantId, toast]);

  // Carregar dados para edição
  useEffect(() => {
    if (!isEditMode || !searchParams) return;

    try {
      // Data do procedimento
      const dtParam = searchParams.get("dtProcedimento");
      if (dtParam) {
        setDtProcedimento(dtParam);
      }

      // Observações
      const obsParam = searchParams.get("observacoes");
      if (obsParam) {
        setObservacoes(obsParam);
      }

      // Produtos
      const produtosParam = searchParams.get("produtos");
      if (produtosParam) {
        try {
          const produtos = JSON.parse(produtosParam);
          const produtosSelecionados: ProdutoSelecionado[] = produtos.map((p: any) => ({
            inventory_item_id: p.inventory_item_id,
            produto_codigo: p.codigo_produto,
            produto_nome: p.nome_produto,
            lote: p.lote,
            quantidade_solicitada: p.quantidade,
            quantidade_disponivel: 0, // Será atualizado pelo próximo useEffect
            valor_unitario: p.valor_unitario,
          }));
          setProdutosSelecionados(produtosSelecionados);
        } catch (e) {
          console.error("Erro ao parsear produtos:", e);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados de edição:", error);
    }
  }, [isEditMode, searchParams]);

  // Atualizar quantidade disponível dos produtos selecionados quando o inventário carregar
  useEffect(() => {
    if (!isEditMode || produtosSelecionados.length === 0 || inventoryItems.length === 0) return;

    // Verificar se já tem quantidade_disponivel > 0 (já foi atualizado)
    const jaAtualizado = produtosSelecionados.some(p => p.quantidade_disponivel > 0);
    if (jaAtualizado) return;

    const produtosAtualizados = produtosSelecionados.map((produtoSelecionado) => {
      const itemInventario = inventoryItems.find(
        (item) => item.id === produtoSelecionado.inventory_item_id
      );

      if (itemInventario) {
        return {
          ...produtoSelecionado,
          quantidade_disponivel: itemInventario.quantidade_disponivel,
          // Preservar nome do produto se veio da URL
          produto_nome: produtoSelecionado.produto_nome || itemInventario.nome_produto,
          produto_codigo: produtoSelecionado.produto_codigo || itemInventario.codigo_produto,
        };
      }

      return produtoSelecionado;
    });

    setProdutosSelecionados(produtosAtualizados);
  }, [inventoryItems, isEditMode, produtosSelecionados]); // Dependências corretas

  // Validações
  const validatePaciente = () => {
    if (!codigoPaciente.trim()) {
      setError("Código do paciente é obrigatório");
      return false;
    }
    if (!nomePaciente.trim()) {
      setError("Nome do paciente é obrigatório");
      return false;
    }
    if (!dtProcedimento) {
      setError("Data do procedimento é obrigatória");
      return false;
    }

    // Validar data não pode ser no passado (mas permite hoje)
    // Usar comparação de strings YYYY-MM-DD para evitar problemas de timezone
    const dataHoje = new Date();
    const anoHoje = dataHoje.getFullYear();
    const mesHoje = String(dataHoje.getMonth() + 1).padStart(2, '0');
    const diaHoje = String(dataHoje.getDate()).padStart(2, '0');
    const dataHojeString = `${anoHoje}-${mesHoje}-${diaHoje}`;

    if (dtProcedimento < dataHojeString) {
      setError("Data do procedimento não pode ser no passado");
      return false;
    }

    setError("");
    return true;
  };

  const handleContinuarParaProdutos = () => {
    if (validatePaciente()) {
      setStep("adicionar_produtos");
    }
  };

  // Função para alocar quantidade usando FEFO (First Expired, First Out)
  const alocarProdutoFEFO = (
    codigoProduto: string,
    quantidadeDesejada: number
  ): ProdutoSelecionado[] => {
    const produtoAgrupado = produtosAgrupados.find(
      (p) => p.codigo_produto === codigoProduto
    );

    if (!produtoAgrupado) return [];

    const alocacoes: ProdutoSelecionado[] = [];
    let quantidadeRestante = quantidadeDesejada;

    // Percorrer lotes ordenados por validade (mais próximo primeiro)
    for (const lote of produtoAgrupado.lotes) {
      if (quantidadeRestante <= 0) break;

      const quantidadeDoLote = Math.min(
        quantidadeRestante,
        lote.quantidade_disponivel
      );

      alocacoes.push({
        inventory_item_id: lote.id,
        produto_codigo: lote.codigo_produto,
        produto_nome: lote.nome_produto,
        lote: lote.lote,
        quantidade_solicitada: quantidadeDoLote,
        quantidade_disponivel: lote.quantidade_disponivel,
        valor_unitario: lote.valor_unitario,
      });

      quantidadeRestante -= quantidadeDoLote;
    }

    return alocacoes;
  };

  const handleAdicionarProduto = () => {
    if (!selectedProductCode) {
      toast({
        title: "Selecione um produto",
        description: "Escolha um produto do inventário",
        variant: "destructive",
      });
      return;
    }

    const quantidade = parseInt(quantidadeSolicitada);
    if (isNaN(quantidade) || quantidade <= 0) {
      toast({
        title: "Quantidade inválida",
        description: "Informe uma quantidade válida",
        variant: "destructive",
      });
      return;
    }

    const produtoAgrupado = produtosAgrupados.find(
      (p) => p.codigo_produto === selectedProductCode
    );

    if (!produtoAgrupado) return;

    // Verificar se há estoque suficiente
    if (quantidade > produtoAgrupado.quantidade_total) {
      toast({
        title: "Estoque insuficiente",
        description: `Disponível: ${produtoAgrupado.quantidade_total} unidades`,
        variant: "destructive",
      });
      return;
    }

    // Verificar se já foi adicionado
    const jaAdicionado = produtosSelecionados.some(
      (p) => p.produto_codigo === selectedProductCode
    );

    if (jaAdicionado) {
      toast({
        title: "Produto já adicionado",
        description: "Este produto já está na lista. Remova-o para adicionar novamente",
        variant: "destructive",
      });
      return;
    }

    // Alocar produto usando FEFO
    const alocacoes = alocarProdutoFEFO(selectedProductCode, quantidade);

    if (alocacoes.length === 0) {
      toast({
        title: "Erro ao alocar produto",
        description: "Não foi possível alocar o produto",
        variant: "destructive",
      });
      return;
    }

    // Adicionar todas as alocações
    setProdutosSelecionados([...produtosSelecionados, ...alocacoes]);
    setSelectedProductCode("");
    setQuantidadeSolicitada("1");

    // Mensagem detalhada sobre os lotes alocados
    const lotesUsados = alocacoes.map((a) => `${a.lote} (${a.quantidade_solicitada} un)`).join(", ");

    toast({
      title: "Produto adicionado",
      description: alocacoes.length === 1
        ? `${produtoAgrupado.nome_produto} - Lote: ${lotesUsados}`
        : `${produtoAgrupado.nome_produto} - Lotes: ${lotesUsados}`,
    });
  };

  const handleRemoverProduto = (inventory_item_id: string) => {
    setProdutosSelecionados(
      produtosSelecionados.filter((p) => p.inventory_item_id !== inventory_item_id)
    );
  };

  const handleIrParaRevisao = () => {
    if (produtosSelecionados.length === 0) {
      toast({
        title: "Adicione produtos",
        description: "Adicione pelo menos um produto ao procedimento",
        variant: "destructive",
      });
      return;
    }

    setValidationErrors([]);
    setStep("revisao");
  };

  const handleConfirmarSolicitacao = async () => {
    if (!tenantId || !user) return;

    try {
      setSaving(true);
      setValidationErrors([]);

      if (isEditMode && editId) {
        // Modo de edição: atualizar procedimento agendado
        const updatePayload: any = {
          paciente_codigo: codigoPaciente,
          paciente_nome: nomePaciente,
          dt_procedimento: new Date(dtProcedimento),
          produtos: produtosSelecionados.map((p) => ({
            inventory_item_id: p.inventory_item_id,
            quantidade: p.quantidade_solicitada,
          })),
        };

        // Só adicionar observações se houver valor
        if (observacoes) {
          updatePayload.observacoes = observacoes;
        }

        const result = await updateSolicitacaoAgendada(
          tenantId,
          editId,
          user.uid,
          user.displayName || user.email || "Usuário",
          updatePayload
        );

        if (result.success) {
          toast({
            title: "Procedimento atualizado com sucesso!",
            description: "As reservas de produtos foram ajustadas",
          });

          router.push(`/clinic/requests/${editId}`);
        } else {
          toast({
            title: "Erro ao atualizar procedimento",
            description: result.error || "Ocorreu um erro ao processar a atualização",
            variant: "destructive",
          });
        }
      } else {
        // Modo de criação: criar novo procedimento
        const input: CreateSolicitacaoInput = {
          paciente_codigo: codigoPaciente,
          paciente_nome: nomePaciente,
          dt_procedimento: new Date(dtProcedimento),
          produtos: produtosSelecionados.map((p) => ({
            inventory_item_id: p.inventory_item_id,
            quantidade: p.quantidade_solicitada,
          })),
          observacoes: observacoes || undefined,
        };

        const result = await createSolicitacaoWithConsumption(
          tenantId,
          user.uid,
          user.displayName || user.email || "Usuário",
          input
        );

        if (result.success) {
          toast({
            title: "Procedimento criado com sucesso!",
            description: "Os produtos foram reservados no inventário",
          });

          router.push(`/clinic/requests/${result.solicitacaoId}`);
        } else {
          if (result.validationErrors && result.validationErrors.length > 0) {
            setValidationErrors(result.validationErrors);
            setStep("revisao"); // Voltar para revisão
          }

          toast({
            title: "Erro ao criar procedimento",
            description: result.error || "Ocorreu um erro ao processar o procedimento",
            variant: "destructive",
          });
        }
      }
    } catch (err: any) {
      console.error(`Erro ao ${isEditMode ? "atualizar" : "criar"} procedimento:`, err);
      toast({
        title: `Erro ao ${isEditMode ? "atualizar" : "criar"} procedimento`,
        description: "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const valorTotal = produtosSelecionados.reduce(
    (sum, p) => sum + p.quantidade_solicitada * p.valor_unitario,
    0
  );

  // Helper para formatar data sem problemas de timezone
  const formatarDataLocal = (dataString: string) => {
    if (!dataString) return "";
    const [ano, mes, dia] = dataString.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  return (
    <div className="container py-8">
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                {isEditMode ? "Editar Procedimento" : "Novo Procedimento"}
              </h2>
              <p className="text-muted-foreground">
                {isEditMode
                  ? "Modifique os dados do procedimento agendado"
                  : "Registre o consumo de produtos para um procedimento"
                }
              </p>
            </div>

            {/* Progress Indicator */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    step === "dados_paciente"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  1
                </div>
                <span className="text-sm">Dados do Paciente</span>
              </div>

              <div className="h-[2px] w-12 bg-border" />

              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    step === "adicionar_produtos"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  2
                </div>
                <span className="text-sm">Adicionar Produtos</span>
              </div>

              <div className="h-[2px] w-12 bg-border" />

              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    step === "revisao"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  3
                </div>
                <span className="text-sm">Revisão e Confirmação</span>
              </div>
            </div>

            {/* PASSO 1: Dados do Paciente */}
            {step === "dados_paciente" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Informações do Paciente e Procedimento
                  </CardTitle>
                  <CardDescription>
                    Informe os dados do paciente e a data do procedimento
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Erro</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Campo de Busca de Paciente com Autocomplete */}
                  <div className="space-y-2">
                    <Label htmlFor="patient-search">
                      Buscar Paciente *
                    </Label>

                    {/* Filtro de busca */}
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setPatientSearchFilter("all")}
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${
                          patientSearchFilter === "all"
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setPatientSearchFilter("codigo")}
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${
                          patientSearchFilter === "codigo"
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        Código
                      </button>
                      <button
                        type="button"
                        onClick={() => setPatientSearchFilter("nome")}
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${
                          patientSearchFilter === "nome"
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        Nome
                      </button>
                      <button
                        type="button"
                        onClick={() => setPatientSearchFilter("telefone")}
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${
                          patientSearchFilter === "telefone"
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        Telefone
                      </button>
                    </div>

                    <div id="patient-search-container" className="relative">
                      <Input
                        id="patient-search"
                        placeholder={
                          patientSearchFilter === "all"
                            ? "Digite código, nome ou telefone..."
                            : patientSearchFilter === "codigo"
                            ? "Digite o código do paciente..."
                            : patientSearchFilter === "nome"
                            ? "Digite o nome do paciente..."
                            : "Digite o telefone do paciente..."
                        }
                        value={patientSearchTerm}
                        onChange={(e) => setPatientSearchTerm(e.target.value)}
                        onFocus={() => {
                          if (patientSuggestions.length > 0) {
                            setShowSuggestions(true);
                          }
                        }}
                      />

                      {/* Lista de Sugestões */}
                      {showSuggestions && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                          {searchingPatients ? (
                            <div className="p-3 text-center text-sm text-gray-500">
                              Buscando...
                            </div>
                          ) : patientSuggestions.length === 0 ? (
                            <div className="p-3 text-center text-sm text-gray-500">
                              Nenhum paciente encontrado
                            </div>
                          ) : (
                            patientSuggestions.map((patient) => (
                              <button
                                key={patient.id}
                                type="button"
                                onClick={() => handleSelectPatient(patient)}
                                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">
                                      {patient.nome}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      Código: {patient.codigo}
                                    </p>
                                    {patient.telefone && (
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        Tel: {patient.telefone}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    {patientSearchTerm.length > 0 && patientSearchTerm.length < 2 && (
                      <p className="text-xs text-gray-500">
                        Digite pelo menos 2 caracteres para buscar
                      </p>
                    )}
                  </div>

                  {/* Paciente Selecionado */}
                  {(codigoPaciente || nomePaciente) && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900">
                            Paciente Selecionado
                          </p>
                          <p className="text-lg font-bold text-blue-900 mt-1">
                            {nomePaciente}
                          </p>
                          <p className="text-sm text-blue-700">
                            Código: {codigoPaciente}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCodigoPaciente("");
                            setNomePaciente("");
                            setPatientSearchTerm("");
                          }}
                          className="text-blue-700 hover:text-blue-900 hover:bg-blue-100"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="dt-procedimento">
                      Data do Procedimento *
                    </Label>
                    <Input
                      id="dt-procedimento"
                      type="date"
                      value={dtProcedimento}
                      onChange={(e) => setDtProcedimento(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="observacoes">Observações (opcional)</Label>
                    <Input
                      id="observacoes"
                      placeholder="Informações adicionais sobre o procedimento"
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleContinuarParaProdutos}>
                      Continuar <Package className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* PASSO 2: Adicionar Produtos */}
            {step === "adicionar_produtos" && (
              <div className="space-y-4">
                {/* Resumo do Paciente */}
                <Card>
                  <CardHeader>
                    <CardTitle>Resumo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <Label className="text-muted-foreground">Paciente</Label>
                        <p className="font-medium">
                          {nomePaciente} ({codigoPaciente})
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">
                          Data do Procedimento
                        </Label>
                        <p className="font-medium">
                          {formatarDataLocal(dtProcedimento)}
                        </p>
                      </div>
                      {observacoes && (
                        <div>
                          <Label className="text-muted-foreground">Observações</Label>
                          <p className="font-medium">{observacoes}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Adicionar Produtos */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Adicionar Produtos do Inventário
                    </CardTitle>
                    <CardDescription>
                      Selecione os produtos utilizados no procedimento
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="produto">Produto</Label>
                        <Select
                          value={selectedProductCode}
                          onValueChange={setSelectedProductCode}
                          disabled={loading}
                        >
                          <SelectTrigger id="produto">
                            <SelectValue placeholder="Selecione um produto" />
                          </SelectTrigger>
                          <SelectContent>
                            {produtosAgrupados.map((produto) => (
                              <SelectItem key={produto.codigo_produto} value={produto.codigo_produto}>
                                {produto.nome_produto} - {produto.quantidade_total} unidades disponíveis
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="quantidade">Quantidade</Label>
                        <div className="flex gap-2">
                          <Input
                            id="quantidade"
                            type="number"
                            min="1"
                            value={quantidadeSolicitada}
                            onChange={(e) => setQuantidadeSolicitada(e.target.value)}
                          />
                          <Button onClick={handleAdicionarProduto}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Lista de Produtos Adicionados */}
                    {produtosSelecionados.length > 0 && (
                      <div className="space-y-2">
                        <Label>Produtos Adicionados ({produtosSelecionados.length})</Label>
                        <div className="border rounded-lg">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Produto</TableHead>
                                <TableHead>Lote</TableHead>
                                <TableHead className="text-right">Quantidade</TableHead>
                                <TableHead className="text-right">Disponível</TableHead>
                                <TableHead className="text-right">Valor Unit.</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {produtosSelecionados.map((produto) => (
                                <TableRow key={produto.inventory_item_id}>
                                  <TableCell className="font-medium">
                                    {produto.produto_nome}
                                    <div className="text-xs text-muted-foreground">
                                      {produto.produto_codigo}
                                    </div>
                                  </TableCell>
                                  <TableCell>{produto.lote}</TableCell>
                                  <TableCell className="text-right">
                                    {produto.quantidade_solicitada}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Badge variant="outline">
                                      {produto.quantidade_disponivel}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    R$ {produto.valor_unitario.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    R${" "}
                                    {(
                                      produto.quantidade_solicitada *
                                      produto.valor_unitario
                                    ).toFixed(2)}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        handleRemoverProduto(produto.inventory_item_id)
                                      }
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                              <TableRow>
                                <TableCell colSpan={5} className="text-right font-bold">
                                  Valor Total:
                                </TableCell>
                                <TableCell className="text-right font-bold">
                                  R$ {valorTotal.toFixed(2)}
                                </TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <Button variant="outline" onClick={() => setStep("dados_paciente")}>
                        Voltar
                      </Button>
                      <Button onClick={handleIrParaRevisao}>
                        Revisar Procedimento <Check className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* PASSO 3: Revisão e Confirmação */}
            {step === "revisao" && (
              <div className="space-y-4">
                {validationErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Erros de Validação</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside">
                        {validationErrors.map((err, index) => (
                          <li key={index}>{err}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Atenção!</AlertTitle>
                  <AlertDescription>
                    {isEditMode
                      ? "Ao confirmar, as reservas de produtos serão ajustadas automaticamente no inventário. Produtos removidos terão suas reservas liberadas, e novos produtos serão reservados."
                      : "Ao confirmar, os produtos serão RESERVADOS no inventário e o procedimento será criado com status \"Agendado\". Os produtos só serão consumidos quando o procedimento for concluído."
                    }
                  </AlertDescription>
                </Alert>

                {/* Revisão dos Dados */}
                <Card>
                  <CardHeader>
                    <CardTitle>Dados do Paciente</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Código</Label>
                        <p className="font-medium">{codigoPaciente}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Nome</Label>
                        <p className="font-medium">{nomePaciente}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">
                          Data do Procedimento
                        </Label>
                        <p className="font-medium">
                          {formatarDataLocal(dtProcedimento)}
                        </p>
                      </div>
                      {observacoes && (
                        <div className="md:col-span-3">
                          <Label className="text-muted-foreground">Observações</Label>
                          <p className="font-medium">{observacoes}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Produtos a Consumir</CardTitle>
                    <CardDescription>
                      {produtosSelecionados.length} produto(s) - Total: R${" "}
                      {valorTotal.toFixed(2)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Lote</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {produtosSelecionados.map((produto) => (
                          <TableRow key={produto.inventory_item_id}>
                            <TableCell>
                              <div className="font-medium">{produto.produto_nome}</div>
                              <div className="text-xs text-muted-foreground">
                                {produto.produto_codigo}
                              </div>
                            </TableCell>
                            <TableCell>{produto.lote}</TableCell>
                            <TableCell className="text-right">
                              {produto.quantidade_solicitada}
                            </TableCell>
                            <TableCell className="text-right">
                              R${" "}
                              {(
                                produto.quantidade_solicitada * produto.valor_unitario
                              ).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setStep("adicionar_produtos")}
                    disabled={saving}
                  >
                    Voltar
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => router.push("/clinic/requests")}
                      disabled={saving}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancelar
                    </Button>
                    <Button onClick={handleConfirmarSolicitacao} disabled={saving}>
                      {saving ? (
                        "Processando..."
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          {isEditMode ? "Confirmar Alterações" : "Confirmar e Reservar Produtos"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
    </div>
  );
}
