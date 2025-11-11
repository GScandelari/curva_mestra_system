"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ClinicLayout } from "@/components/clinic/ClinicLayout";
import { FileUpload } from "@/components/upload/FileUpload";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Upload,
  CheckCircle,
  AlertCircle,
  FileText,
  Package,
  Loader2,
} from "lucide-react";
import {
  uploadNFFile,
  createNFImport,
  processNFAndAddToInventory,
} from "@/lib/services/nfImportService";
import type { ParsedNF } from "@/types/nf";

export default function UploadPage() {
  const { user, claims } = useAuth();
  const router = useRouter();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [nfNumber, setNfNumber] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "processing" | "preview" | "confirming" | "success" | "error"
  >("idle");
  const [error, setError] = useState("");
  const [importId, setImportId] = useState("");
  const [parsedData, setParsedData] = useState<ParsedNF | null>(null);

  const tenantId = claims?.tenant_id;
  const userId = user?.uid;
  const isAdmin = claims?.role === "clinic_admin";

  // Apenas admins podem fazer upload
  if (!isAdmin) {
    return (
      <ProtectedRoute allowedRoles={["clinic_admin"]}>
        <ClinicLayout>
          <div className="container py-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Acesso Negado</AlertTitle>
              <AlertDescription>
                Apenas administradores podem fazer upload de DANFE
              </AlertDescription>
            </Alert>
          </div>
        </ClinicLayout>
      </ProtectedRoute>
    );
  }

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError("");
    setUploadStatus("idle");

    // Tentar extrair número da NF do nome do arquivo
    const match = file.name.match(/(\d{6,})/);
    if (match) {
      setNfNumber(match[1]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !tenantId || !userId) {
      setError("Arquivo não selecionado ou usuário não autenticado");
      return;
    }

    if (!nfNumber.trim()) {
      setError("Por favor, informe o número da Nota Fiscal");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setUploadStatus("uploading");
      setUploadProgress(0);

      // Simular progresso de upload
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      // 1. Upload do arquivo
      const fileUrl = await uploadNFFile(tenantId, selectedFile);
      setUploadProgress(100);
      clearInterval(progressInterval);

      // 2. Criar registro de importação
      const newImportId = await createNFImport({
        tenant_id: tenantId,
        numero_nf: nfNumber,
        arquivo_nome: selectedFile.name,
        arquivo_url: fileUrl,
        created_by: userId,
      });

      setImportId(newImportId);
      setUploadStatus("processing");

      // 3. Simular processamento OCR
      // TODO: Substituir por chamada real ao OCR quando implementado
      await simulateOCRProcessing();

      const mockParsedData: ParsedNF = {
        numero: nfNumber,
        produtos: [
          {
            codigo: "3029055",
            nome_produto: "TORNEIRA DESCARTAVEL 3VIAS LL",
            lote: "SCTPAB002B",
            quantidade: 5,
            dt_validade: "01/06/2029",
            valor_unitario: 1.55,
          },
          {
            codigo: "3029056",
            nome_produto: "SERINGA 3ML S/AGULHA LL",
            lote: "SYRPAB001A",
            quantidade: 100,
            dt_validade: "15/12/2028",
            valor_unitario: 0.45,
          },
        ],
      };

      setParsedData(mockParsedData);

      // 4. Mostrar preview para confirmação do usuário
      setUploadStatus("preview");
    } catch (err: any) {
      console.error("Erro no upload:", err);
      setError(err.message || "Erro ao fazer upload do arquivo");
      setUploadStatus("error");
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedData || !tenantId || !importId) {
      setError("Dados não disponíveis para confirmação");
      return;
    }

    try {
      setUploadStatus("confirming");
      setError("");

      // Processar e adicionar ao inventário
      const result = await processNFAndAddToInventory(
        tenantId,
        importId,
        parsedData
      );

      if (result.success) {
        setUploadStatus("success");
      } else {
        setUploadStatus("error");
        setError(result.message);
      }
    } catch (err: any) {
      console.error("Erro ao confirmar importação:", err);
      setError(err.message || "Erro ao adicionar produtos ao estoque");
      setUploadStatus("error");
    }
  };

  const simulateOCRProcessing = () => {
    return new Promise((resolve) => setTimeout(resolve, 2000));
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setNfNumber("");
    setUploadStatus("idle");
    setError("");
    setImportId("");
    setParsedData(null);
    setUploadProgress(0);
  };

  return (
    <ProtectedRoute allowedRoles={["clinic_admin"]}>
      <ClinicLayout>
        <div className="container py-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/clinic/dashboard")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <div className="flex-1">
                <h2 className="text-3xl font-bold tracking-tight">
                  Upload de DANFE
                </h2>
                <p className="text-muted-foreground">
                  Importar produtos da Nota Fiscal Eletrônica
                </p>
              </div>
            </div>

            {/* Upload Form */}
            {uploadStatus === "idle" && (
              <Card>
                <CardHeader>
                  <CardTitle>Selecionar Arquivo</CardTitle>
                  <CardDescription>
                    Faça upload do PDF da NF-e Rennova para importar os
                    produtos automaticamente
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* File Upload */}
                  <FileUpload
                    onFileSelect={handleFileSelect}
                    disabled={uploading}
                  />

                  {/* NF Number Input */}
                  {selectedFile && (
                    <div className="space-y-2">
                      <Label htmlFor="nf-number">
                        Número da Nota Fiscal *
                      </Label>
                      <Input
                        id="nf-number"
                        type="text"
                        placeholder="Ex: 026229"
                        value={nfNumber}
                        onChange={(e) => setNfNumber(e.target.value)}
                        disabled={uploading}
                      />
                      <p className="text-xs text-muted-foreground">
                        Informe o número da NF-e para referência
                      </p>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Erro</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Actions */}
                  {selectedFile && (
                    <div className="flex gap-3">
                      <Button
                        onClick={handleUpload}
                        disabled={uploading || !nfNumber.trim()}
                        className="flex-1"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processando...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Importar NF-e
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={resetUpload}
                        disabled={uploading}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Uploading Status */}
            {uploadStatus === "uploading" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    Fazendo Upload...
                  </CardTitle>
                  <CardDescription>
                    Enviando arquivo para o servidor
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progresso</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <FileText className="inline h-4 w-4 mr-1" />
                    {selectedFile?.name}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Processing Status */}
            {uploadStatus === "processing" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    Processando NF-e...
                  </CardTitle>
                  <CardDescription>
                    Extraindo informações dos produtos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      Lendo arquivo PDF...
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      Extraindo dados dos produtos...
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      Validando informações...
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Isso pode levar alguns segundos...
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Preview Status - Aguardando Confirmação */}
            {uploadStatus === "preview" && parsedData && (
              <Card className="border-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-600">
                    <AlertCircle className="h-5 w-5" />
                    Confirmar Importação
                  </CardTitle>
                  <CardDescription>
                    Revise os produtos extraídos da NF-e {parsedData.numero} antes de adicionar ao estoque
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Produtos Encontrados
                      </p>
                      <p className="text-2xl font-bold text-blue-600">
                        {parsedData.produtos.length}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Número da NF
                      </p>
                      <p className="text-2xl font-bold">{parsedData.numero}</p>
                    </div>
                  </div>

                  {/* Products List */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Produtos que serão adicionados ao estoque:
                    </p>
                    <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-3 bg-muted/30">
                      {parsedData.produtos.map((produto, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 bg-background border rounded-lg hover:border-blue-300 transition-colors"
                        >
                          <Package className="h-5 w-5 text-blue-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {produto.nome_produto}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Código: {produto.codigo} • Lote: {produto.lote}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Quantidade: {produto.quantidade} un. • Validade: {produto.dt_validade} • R$ {produto.valor_unitario.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Warning */}
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Atenção</AlertTitle>
                    <AlertDescription>
                      Ao confirmar, estes produtos serão adicionados permanentemente ao estoque da clínica.
                      Verifique se todas as informações estão corretas antes de prosseguir.
                    </AlertDescription>
                  </Alert>

                  {/* Error */}
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Erro</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleConfirmImport}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      disabled={uploadStatus === "confirming"}
                    >
                      {uploadStatus === "confirming" ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adicionando ao Estoque...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Confirmar e Adicionar ao Estoque
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetUpload}
                      disabled={uploadStatus === "confirming"}
                    >
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Confirming Status */}
            {uploadStatus === "confirming" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    Adicionando ao Estoque...
                  </CardTitle>
                  <CardDescription>
                    Salvando produtos no inventário
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      Validando produtos...
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      Atualizando inventário...
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      Registrando entrada...
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Aguarde enquanto os produtos são adicionados ao estoque...
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Success Status */}
            {uploadStatus === "success" && parsedData && (
              <Card className="border-green-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    Importação Concluída!
                  </CardTitle>
                  <CardDescription>
                    NF-e {parsedData.numero} processada com sucesso
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Produtos Importados
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {parsedData.produtos.length}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Número da NF
                      </p>
                      <p className="text-2xl font-bold">{parsedData.numero}</p>
                    </div>
                  </div>

                  {/* Products List */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Produtos Adicionados ao Estoque:
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {parsedData.produtos.map((produto, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 border rounded-lg"
                        >
                          <Package className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {produto.nome_produto}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Lote: {produto.lote} • {produto.quantidade} un. •
                              Val: {produto.dt_validade}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button
                      onClick={() => router.push("/clinic/inventory")}
                      className="flex-1"
                    >
                      Ver Estoque
                    </Button>
                    <Button variant="outline" onClick={resetUpload}>
                      Nova Importação
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error Status */}
            {uploadStatus === "error" && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    Erro na Importação
                  </CardTitle>
                  <CardDescription>
                    Não foi possível processar a NF-e
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Detalhes do Erro</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>

                  <div className="flex gap-3">
                    <Button onClick={resetUpload} className="flex-1">
                      Tentar Novamente
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => router.push("/clinic/dashboard")}
                    >
                      Voltar ao Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </ClinicLayout>
    </ProtectedRoute>
  );
}
