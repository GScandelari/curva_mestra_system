"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";

interface MasterProduct {
  id: string;
  code: string;
  name: string;
}

interface NFProduct {
  master_product_id?: string;
  codigo: string;
  nome_produto: string;
  lote: string;
  quantidade: number;
  dt_validade: string;
  valor_unitario: number;
}

export default function ManualNFPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, tenantId } = useAuth();

  const [step, setStep] = useState<"select_type" | "enter_nf" | "add_products" | "review">("select_type");
  const [tipoNF, setTipoNF] = useState<"rennova" | "outra_marca" | null>(null);
  const [numeroNF, setNumeroNF] = useState("");
  const [produtos, setProdutos] = useState<NFProduct[]>([]);
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form fields para adicionar produto
  const [selectedProduct, setSelectedProduct] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<MasterProduct[]>([]);
  const [lote, setLote] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [dtValidade, setDtValidade] = useState("");
  const [valorUnitario, setValorUnitario] = useState("");

  // Form fields para produtos de outra marca
  const [codigoOutraMarca, setCodigoOutraMarca] = useState("");
  const [nomeOutraMarca, setNomeOutraMarca] = useState("");

  useEffect(() => {
    if (tipoNF === "rennova") {
      loadMasterProducts();
    }
  }, [tipoNF]);

  // Filtrar produtos conforme busca
  useEffect(() => {
    if (!productSearch) {
      setFilteredProducts(masterProducts);
      return;
    }

    const searchLower = productSearch.toLowerCase();
    const filtered = masterProducts.filter(
      (p) =>
        p.code.toLowerCase().includes(searchLower) ||
        p.name.toLowerCase().includes(searchLower)
    );
    setFilteredProducts(filtered);
  }, [productSearch, masterProducts]);

  const handleSelectType = (type: "rennova" | "outra_marca") => {
    setTipoNF(type);
    setStep("enter_nf");
  };

  const handleContinueToProducts = () => {
    if (!numeroNF) {
      toast({
        title: "Número da NF obrigatório",
        description: "Informe o número da nota fiscal antes de continuar",
        variant: "destructive",
      });
      return;
    }
    setStep("add_products");
  };

  const loadMasterProducts = async () => {
    try {
      const q = query(
        collection(db, "master_products"),
        where("active", "==", true)
      );
      const snapshot = await getDocs(q);
      const products = snapshot.docs.map((doc) => ({
        id: doc.id,
        code: doc.data().code,
        name: doc.data().name,
      }));
      setMasterProducts(products);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os produtos Rennova",
        variant: "destructive",
      });
    }
  };

  const handleAddProduct = () => {
    console.log("handleAddProduct called", { tipoNF, selectedProduct, lote, quantidade, dtValidade, valorUnitario });

    if (tipoNF === "rennova") {
      // Validar campos Rennova
      if (!selectedProduct || !lote || !quantidade || !dtValidade || !valorUnitario) {
        console.log("Validation failed - missing fields");
        toast({
          title: "Campos obrigatórios",
          description: "Preencha todos os campos para adicionar o produto",
          variant: "destructive",
        });
        return;
      }

      const product = masterProducts.find((p) => p.id === selectedProduct);
      console.log("Found product:", product);
      if (!product) return;

      const newProduct: NFProduct = {
        master_product_id: product.id,
        codigo: product.code,
        nome_produto: product.name,
        lote,
        quantidade: parseFloat(quantidade),
        dt_validade: dtValidade,
        valor_unitario: parseFloat(valorUnitario),
      };

      console.log("Adding product:", newProduct);
      setProdutos([...produtos, newProduct]);
    } else {
      // Validar campos de outra marca
      if (!codigoOutraMarca || !nomeOutraMarca || !lote || !quantidade || !dtValidade || !valorUnitario) {
        toast({
          title: "Campos obrigatórios",
          description: "Preencha todos os campos para adicionar o produto",
          variant: "destructive",
        });
        return;
      }

      const newProduct: NFProduct = {
        codigo: codigoOutraMarca,
        nome_produto: nomeOutraMarca,
        lote,
        quantidade: parseFloat(quantidade),
        dt_validade: dtValidade,
        valor_unitario: parseFloat(valorUnitario),
      };

      setProdutos([...produtos, newProduct]);
    }

    // Limpar campos
    setSelectedProduct("");
    setProductSearch("");
    setShowSuggestions(false);
    setCodigoOutraMarca("");
    setNomeOutraMarca("");
    setLote("");
    setQuantidade("");
    setDtValidade("");
    setValorUnitario("");
    setIsDialogOpen(false);

    toast({
      title: "Produto adicionado",
      description: "Produto adicionado à lista com sucesso",
    });
  };

  const handleRemoveProduct = (index: number) => {
    setProdutos(produtos.filter((_, i) => i !== index));
    toast({
      title: "Produto removido",
      description: "Produto removido da lista",
    });
  };

  const handleGoToReview = () => {
    if (produtos.length === 0) {
      toast({
        title: "Adicione produtos",
        description: "Adicione pelo menos um produto antes de continuar",
        variant: "destructive",
      });
      return;
    }
    setStep("review");
  };

  const handleSaveNF = async () => {
    console.log("handleSaveNF called", { numeroNF, produtos, tenantId });

    if (!numeroNF) {
      console.log("Validation failed - no numeroNF");
      toast({
        title: "Número da NF obrigatório",
        description: "Informe o número da nota fiscal",
        variant: "destructive",
      });
      return;
    }

    if (produtos.length === 0) {
      console.log("Validation failed - no products");
      toast({
        title: "Adicione produtos",
        description: "Adicione pelo menos um produto à nota fiscal",
        variant: "destructive",
      });
      return;
    }

    if (!tenantId) {
      console.log("Validation failed - no tenantId");
      toast({
        title: "Erro",
        description: "Tenant ID não encontrado",
        variant: "destructive",
      });
      return;
    }

    console.log("Starting save process...");
    setIsLoading(true);

    try {
      // Salvar NF no Firestore
      const nfData = {
        tenant_id: tenantId,
        numero_nf: numeroNF,
        tipo: tipoNF,
        produtos: produtos,
        status: "success",
        created_by: user?.email || "unknown",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };

      console.log("Creating NF document with data:", nfData);
      const nfRef = await addDoc(
        collection(db, `tenants/${tenantId}/nf_imports`),
        nfData
      );
      console.log("NF document created with ID:", nfRef.id);

      // Adicionar produtos ao inventário
      console.log("Adding products to inventory...");
      for (const produto of produtos) {
        const inventoryData = {
          tenant_id: tenantId,
          nf_import_id: nfRef.id,
          nf_numero: numeroNF,
          master_product_id: produto.master_product_id || null,
          produto_id: produto.master_product_id || null,
          codigo_produto: produto.codigo,
          nome_produto: produto.nome_produto,
          lote: produto.lote,
          quantidade_inicial: produto.quantidade,
          quantidade_disponivel: produto.quantidade,
          dt_validade: produto.dt_validade,
          dt_entrada: serverTimestamp(),
          valor_unitario: produto.valor_unitario,
          active: true,
          is_rennova: tipoNF === "rennova",
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        };

        console.log("Adding inventory item:", inventoryData);
        await addDoc(
          collection(db, `tenants/${tenantId}/inventory`),
          inventoryData
        );
      }

      console.log("All products added to inventory successfully");
      toast({
        title: "Nota fiscal salva",
        description: `NF ${numeroNF} foi salva e os produtos adicionados ao inventário`,
      });

      console.log("Redirecting to inventory page...");
      // Redirecionar para o inventário
      router.push("/clinic/inventory");
    } catch (error) {
      console.error("Erro ao salvar NF:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a nota fiscal",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStepNumber = () => {
    switch (step) {
      case "select_type": return 1;
      case "enter_nf": return 2;
      case "add_products": return 3;
      case "review": return 4;
      default: return 1;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Inserção Manual de Produtos</h1>
          <p className="text-muted-foreground">
            Adicione produtos manualmente ao inventário
          </p>
        </div>
      </div>

      {/* Indicador de Progresso */}
      {step !== "select_type" && (
        <div className="mb-6">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {/* Step 1: Tipo */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                getStepNumber() >= 1 ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground text-muted-foreground"
              }`}>
                1
              </div>
              <span className="text-xs text-center">Tipo</span>
            </div>
            <div className={`flex-1 h-[2px] ${getStepNumber() >= 2 ? "bg-primary" : "bg-muted"}`} />

            {/* Step 2: NF */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                getStepNumber() >= 2 ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground text-muted-foreground"
              }`}>
                2
              </div>
              <span className="text-xs text-center">Nº NF</span>
            </div>
            <div className={`flex-1 h-[2px] ${getStepNumber() >= 3 ? "bg-primary" : "bg-muted"}`} />

            {/* Step 3: Produtos */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                getStepNumber() >= 3 ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground text-muted-foreground"
              }`}>
                3
              </div>
              <span className="text-xs text-center">Produtos</span>
            </div>
            <div className={`flex-1 h-[2px] ${getStepNumber() >= 4 ? "bg-primary" : "bg-muted"}`} />

            {/* Step 4: Revisão */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                getStepNumber() >= 4 ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground text-muted-foreground"
              }`}>
                4
              </div>
              <span className="text-xs text-center">Revisão</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {/* Passo 1: Seleção de tipo de produto */}
        {step === "select_type" && (
          <Card>
            <CardHeader>
              <CardTitle>Selecione o tipo de produto</CardTitle>
              <CardDescription>
                Escolha se deseja adicionar produtos Rennova ou de outras marcas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-32 text-lg"
                  onClick={() => handleSelectType("rennova")}
                >
                  Adicionar Produtos Rennova
                </Button>
                <Button
                  variant="outline"
                  className="h-32 text-lg"
                  onClick={() => handleSelectType("outra_marca")}
                >
                  Adicionar Outras Marcas
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Passo 2: Informar número da NF */}
        {step === "enter_nf" && (
          <Card>
            <CardHeader>
              <CardTitle>Número da Nota Fiscal</CardTitle>
              <CardDescription>
                Informe o número da NF para {tipoNF === "rennova" ? "produtos Rennova" : "outras marcas"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="numero-nf">Número da NF</Label>
                <Input
                  id="numero-nf"
                  placeholder="Ex: 026229"
                  value={numeroNF}
                  onChange={(e) => setNumeroNF(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep("select_type")}>
                  Voltar
                </Button>
                <Button onClick={handleContinueToProducts}>
                  Continuar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Passo 3: Adicionar produtos */}
        {step === "add_products" && (
          <>
            {/* Informações da NF (resumo) */}
            <Card>
              <CardHeader>
                <CardTitle>Informações da Nota Fiscal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Número da NF</Label>
                    <p className="font-medium">{numeroNF}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Tipo</Label>
                    <p className="font-medium">
                      {tipoNF === "rennova" ? "Produtos Rennova" : "Outras Marcas"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

        {/* Card de produtos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Produtos</CardTitle>
              <CardDescription>
                Lista de produtos adicionados à nota fiscal
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Produto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Adicionar Produto</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do produto a ser adicionado
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {tipoNF === "rennova" ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="produto">Produto Rennova</Label>
                        <div className="relative">
                          <Input
                            id="produto"
                            placeholder="Digite para buscar produto (código ou nome)..."
                            value={productSearch}
                            onChange={(e) => {
                              setProductSearch(e.target.value);
                              setShowSuggestions(true);
                              setSelectedProduct(""); // Limpar seleção ao editar
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            autoComplete="off"
                          />
                          {showSuggestions && productSearch && filteredProducts.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
                              {filteredProducts.slice(0, 10).map((product) => (
                                <button
                                  key={product.id}
                                  type="button"
                                  className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors text-sm"
                                  onClick={() => {
                                    setSelectedProduct(product.id);
                                    setProductSearch(`${product.code} - ${product.name}`);
                                    setShowSuggestions(false);
                                  }}
                                >
                                  <span className="font-mono font-semibold">{product.code}</span>
                                  {" - "}
                                  <span>{product.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {showSuggestions && productSearch && filteredProducts.length === 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md p-3 text-sm text-muted-foreground">
                              Nenhum produto encontrado
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="codigo-outra">Código do Produto</Label>
                        <Input
                          id="codigo-outra"
                          placeholder="Ex: 1234567"
                          value={codigoOutraMarca}
                          onChange={(e) => setCodigoOutraMarca(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nome-outra">Nome do Produto</Label>
                        <Input
                          id="nome-outra"
                          placeholder="Ex: PRODUTO TESTE"
                          value={nomeOutraMarca}
                          onChange={(e) => setNomeOutraMarca(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lote">Lote</Label>
                      <Input
                        id="lote"
                        placeholder="Ex: ABC123"
                        value={lote}
                        onChange={(e) => setLote(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantidade">Quantidade</Label>
                      <Input
                        id="quantidade"
                        type="number"
                        placeholder="Ex: 10"
                        value={quantidade}
                        onChange={(e) => setQuantidade(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dt-validade">Data de Validade</Label>
                      <Input
                        id="dt-validade"
                        type="date"
                        value={dtValidade}
                        onChange={(e) => setDtValidade(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="valor-unitario">Valor Unitário (R$)</Label>
                      <Input
                        id="valor-unitario"
                        type="number"
                        step="0.01"
                        placeholder="Ex: 10.50"
                        value={valorUnitario}
                        onChange={(e) => setValorUnitario(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleAddProduct}>
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {produtos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum produto adicionado. Clique em "Adicionar Produto" para
                começar.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Valor Unit.</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtos.map((produto, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono">
                        {produto.codigo}
                      </TableCell>
                      <TableCell>{produto.nome_produto}</TableCell>
                      <TableCell>{produto.lote}</TableCell>
                      <TableCell>{produto.quantidade}</TableCell>
                      <TableCell>{produto.dt_validade}</TableCell>
                      <TableCell>
                        R$ {produto.valor_unitario.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveProduct(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

            {/* Botões de ação */}
            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => setStep("enter_nf")}>
                Voltar
              </Button>
              <Button
                onClick={handleGoToReview}
                disabled={produtos.length === 0}
              >
                Revisar e Confirmar
              </Button>
            </div>
          </>
        )}

        {/* Passo 4: Revisão e Confirmação */}
        {step === "review" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Revisão da Nota Fiscal</CardTitle>
                <CardDescription>
                  Revise todos os dados antes de confirmar o salvamento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Informações da NF */}
                <div>
                  <h3 className="font-semibold mb-3">Informações da Nota Fiscal</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
                    <div>
                      <Label className="text-muted-foreground">Número da NF</Label>
                      <p className="font-medium">{numeroNF}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Tipo</Label>
                      <p className="font-medium">
                        {tipoNF === "rennova" ? "Produtos Rennova" : "Outras Marcas"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Lista de produtos */}
                <div>
                  <h3 className="font-semibold mb-3">
                    Produtos ({produtos.length})
                  </h3>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Lote</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead>Validade</TableHead>
                          <TableHead className="text-right">Valor Unit.</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {produtos.map((produto, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono">
                              {produto.codigo}
                            </TableCell>
                            <TableCell>{produto.nome_produto}</TableCell>
                            <TableCell>{produto.lote}</TableCell>
                            <TableCell className="text-right">
                              {produto.quantidade}
                            </TableCell>
                            <TableCell>{produto.dt_validade}</TableCell>
                            <TableCell className="text-right">
                              R$ {produto.valor_unitario.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              R$ {(produto.quantidade * produto.valor_unitario).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={6} className="text-right font-bold">
                            Valor Total:
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            R${" "}
                            {produtos
                              .reduce(
                                (sum, p) => sum + p.quantidade * p.valor_unitario,
                                0
                              )
                              .toFixed(2)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Alerta de confirmação */}
                <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-yellow-600 dark:text-yellow-400 mt-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-yellow-800 dark:text-yellow-300">
                        Atenção
                      </h4>
                      <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                        Ao confirmar, a nota fiscal será salva e todos os produtos serão adicionados ao inventário da clínica.
                        Esta ação não pode ser desfeita automaticamente.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Botões de ação */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("add_products")}>
                Voltar e Editar
              </Button>
              <Button
                onClick={handleSaveNF}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? "Salvando..." : "Confirmar e Salvar"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
