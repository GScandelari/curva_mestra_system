"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ClinicLayout } from "@/components/clinic/ClinicLayout";
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
import { listInventory } from "@/lib/services/inventoryService";
import {
  createSolicitacaoWithConsumption,
  type CreateSolicitacaoInput,
} from "@/lib/services/solicitacaoService";
import type { InventoryItem } from "@/types";

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

export default function NovaSolicitacaoPage() {
  const { user, claims } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const tenantId = claims?.tenant_id;

  // Estados do formulário
  const [step, setStep] = useState<Step>("dados_paciente");
  const [codigoPaciente, setCodigoPaciente] = useState("");
  const [nomePaciente, setNomePaciente] = useState("");
  const [dtProcedimento, setDtProcedimento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Estados de produtos
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [produtosSelecionados, setProdutosSelecionados] = useState<ProdutoSelecionado[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantidadeSolicitada, setQuantidadeSolicitada] = useState("1");

  // Estados de loading e erro
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

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

    // Validar data não pode ser no passado
    const dataSelecionada = new Date(dtProcedimento);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (dataSelecionada < hoje) {
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

  const handleAdicionarProduto = () => {
    if (!selectedProductId) {
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

    const produtoInventario = inventoryItems.find(
      (item) => item.id === selectedProductId
    );

    if (!produtoInventario) return;

    if (quantidade > produtoInventario.quantidade_disponivel) {
      toast({
        title: "Estoque insuficiente",
        description: `Disponível: ${produtoInventario.quantidade_disponivel} unidades`,
        variant: "destructive",
      });
      return;
    }

    // Verificar se já foi adicionado
    const jaAdicionado = produtosSelecionados.some(
      (p) => p.inventory_item_id === selectedProductId
    );

    if (jaAdicionado) {
      toast({
        title: "Produto já adicionado",
        description: "Este produto já está na lista. Remova-o para adicionar novamente",
        variant: "destructive",
      });
      return;
    }

    const novoProduto: ProdutoSelecionado = {
      inventory_item_id: produtoInventario.id,
      produto_codigo: produtoInventario.codigo_produto,
      produto_nome: produtoInventario.nome_produto,
      lote: produtoInventario.lote,
      quantidade_solicitada: quantidade,
      quantidade_disponivel: produtoInventario.quantidade_disponivel,
      valor_unitario: produtoInventario.valor_unitario,
    };

    setProdutosSelecionados([...produtosSelecionados, novoProduto]);
    setSelectedProductId("");
    setQuantidadeSolicitada("1");

    toast({
      title: "Produto adicionado",
      description: `${produtoInventario.nome_produto} adicionado à solicitação`,
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
        description: "Adicione pelo menos um produto à solicitação",
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
          title: "Solicitação criada com sucesso!",
          description: "Os produtos foram consumidos do inventário",
        });

        router.push(`/clinic/requests/${result.solicitacaoId}`);
      } else {
        if (result.validationErrors && result.validationErrors.length > 0) {
          setValidationErrors(result.validationErrors);
          setStep("revisao"); // Voltar para revisão
        }

        toast({
          title: "Erro ao criar solicitação",
          description: result.error || "Ocorreu um erro ao processar a solicitação",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Erro ao criar solicitação:", err);
      toast({
        title: "Erro ao criar solicitação",
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

  return (
    <ProtectedRoute allowedRoles={["clinic_admin", "clinic_user"]}>
      <ClinicLayout>
        <div className="container py-8">
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                Nova Solicitação de Produtos
              </h2>
              <p className="text-muted-foreground">
                Registre o consumo de produtos para um procedimento
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="codigo-paciente">
                        Código do Paciente *
                      </Label>
                      <Input
                        id="codigo-paciente"
                        placeholder="Ex: P001"
                        value={codigoPaciente}
                        onChange={(e) => setCodigoPaciente(e.target.value.toUpperCase())}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="nome-paciente">Nome do Paciente *</Label>
                      <Input
                        id="nome-paciente"
                        placeholder="Nome completo"
                        value={nomePaciente}
                        onChange={(e) => setNomePaciente(e.target.value)}
                      />
                    </div>
                  </div>

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
                          {new Date(dtProcedimento).toLocaleDateString("pt-BR")}
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
                          value={selectedProductId}
                          onValueChange={setSelectedProductId}
                          disabled={loading}
                        >
                          <SelectTrigger id="produto">
                            <SelectValue placeholder="Selecione um produto" />
                          </SelectTrigger>
                          <SelectContent>
                            {inventoryItems.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.nome_produto} (Lote: {item.lote}) -{" "}
                                {item.quantidade_disponivel} disponíveis
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
                        Revisar Solicitação <Check className="ml-2 h-4 w-4" />
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
                    Ao confirmar, os produtos serão imediatamente consumidos do inventário.
                    Esta ação não pode ser desfeita automaticamente.
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
                          {new Date(dtProcedimento).toLocaleDateString("pt-BR")}
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
                          Confirmar e Consumir Produtos
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </ClinicLayout>
    </ProtectedRoute>
  );
}
