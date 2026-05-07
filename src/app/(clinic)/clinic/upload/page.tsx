'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUpload } from '@/components/upload/FileUpload';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  Upload,
  CheckCircle,
  AlertCircle,
  FileText,
  Package,
  Loader2,
} from 'lucide-react';
import {
  uploadNFFile,
  createNFImport,
  processNFAndAddToInventory,
} from '@/lib/services/nfImportService';
import type { ParsedNF, XmlParseError } from '@/types/nf';

export default function UploadPage() {
  const { user, claims } = useAuth();
  const router = useRouter();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'uploading' | 'processing' | 'preview' | 'confirming' | 'success' | 'error'
  >('idle');
  const [error, setError] = useState('');
  const [importId, setImportId] = useState('');
  const [parsedData, setParsedData] = useState<ParsedNF | null>(null);
  const [warnings, setWarnings] = useState<XmlParseError[]>([]);

  const tenantId = claims?.tenant_id;
  const userId = user?.uid;
  const isAdmin = claims?.role === 'clinic_admin';

  if (!isAdmin) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acesso Negado</AlertTitle>
          <AlertDescription>Apenas administradores podem fazer upload de NF-e</AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError('');
    setUploadStatus('idle');
  };

  const handleUpload = async () => {
    if (!selectedFile || !tenantId || !userId) {
      setError('Arquivo não selecionado ou usuário não autenticado');
      return;
    }

    try {
      setUploading(true);
      setError('');
      setUploadStatus('uploading');
      setUploadProgress(0);

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

      setUploadStatus('processing');

      // 2. Processar XML usando a API NF-e
      let parsedNF: ParsedNF;
      let parseWarnings: XmlParseError[] = [];

      try {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const response = await fetch('/api/parse-nf-xml', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? 'Erro ao processar XML da NF-e');
        }

        const parseResult = (await response.json()) as {
          parsedNF: ParsedNF;
          warnings: XmlParseError[];
        };

        if (!parseResult.parsedNF || parseResult.parsedNF.produtos.length === 0) {
          throw new Error(
            'Nenhum produto foi encontrado no XML. Verifique se o arquivo é uma NF-e SEFAZ válida.'
          );
        }

        parsedNF = parseResult.parsedNF;
        parseWarnings = parseResult.warnings ?? [];
      } catch (parseError: unknown) {
        const msg =
          parseError instanceof Error ? parseError.message : 'Erro ao processar o XML da NF-e';
        setError(msg);
        setUploadStatus('error');
        return;
      }

      // 3. Criar registro de importação com número extraído do XML
      const newImportId = await createNFImport({
        tenant_id: tenantId,
        numero_nf: parsedNF.numero,
        arquivo_nome: selectedFile.name,
        arquivo_url: fileUrl,
        created_by: userId,
      });

      setImportId(newImportId);
      setParsedData(parsedNF);

      if (parseWarnings.length > 0) {
        setWarnings(parseWarnings);
      }

      // 4. Mostrar preview para confirmação do usuário
      setUploadStatus('preview');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao fazer upload do arquivo';
      setError(msg);
      setUploadStatus('error');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedData || !tenantId || !importId) {
      setError('Dados não disponíveis para confirmação');
      return;
    }

    try {
      setUploadStatus('confirming');
      setError('');

      const result = await processNFAndAddToInventory(tenantId, importId, parsedData);

      if (result.success) {
        setUploadStatus('success');
      } else {
        setUploadStatus('error');
        setError(result.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao adicionar produtos ao estoque';
      setError(msg);
      setUploadStatus('error');
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadStatus('idle');
    setError('');
    setImportId('');
    setParsedData(null);
    setUploadProgress(0);
    setWarnings([]);
  };

  return (
    <div className="container py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/clinic/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex-1">
            <h2 className="text-3xl font-bold tracking-tight">Upload de NF-e</h2>
            <p className="text-muted-foreground">
              Importar produtos via XML da Nota Fiscal Eletrônica
            </p>
          </div>
        </div>

        {/* Upload Form */}
        {uploadStatus === 'idle' && (
          <Card>
            <CardHeader>
              <CardTitle>Selecionar Arquivo</CardTitle>
              <CardDescription>
                Faça upload do XML da NF-e para importar os produtos automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FileUpload onFileSelect={handleFileSelect} disabled={uploading} />

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {selectedFile && (
                <div className="flex gap-3">
                  <Button onClick={handleUpload} disabled={uploading} className="flex-1">
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
                  <Button variant="outline" onClick={resetUpload} disabled={uploading}>
                    Cancelar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Uploading Status */}
        {uploadStatus === 'uploading' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Fazendo Upload...
              </CardTitle>
              <CardDescription>Enviando arquivo para o servidor</CardDescription>
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
        {uploadStatus === 'processing' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Processando NF-e...
              </CardTitle>
              <CardDescription>Extraindo informações dos produtos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  Lendo arquivo XML...
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
              <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos...</p>
            </CardContent>
          </Card>
        )}

        {/* Preview Status - Aguardando Confirmação */}
        {uploadStatus === 'preview' && parsedData && (
          <Card className="border-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600">
                <AlertCircle className="h-5 w-5" />
                Confirmar Importação
              </CardTitle>
              <CardDescription>
                Revise os produtos extraídos da NF-e {parsedData.numero} antes de adicionar ao
                estoque
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Produtos Encontrados</p>
                  <p className="text-2xl font-bold text-blue-600">{parsedData.produtos.length}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Número da NF</p>
                  <p className="text-2xl font-bold">{parsedData.numero}</p>
                </div>
              </div>

              {/* Products List */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Produtos que serão adicionados ao estoque:</p>
                <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-3 bg-muted/30">
                  {parsedData.produtos.map((produto, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 bg-background border rounded-lg hover:border-blue-300 transition-colors ${
                        produto.sem_rastro ? 'border-amber-300' : ''
                      }`}
                    >
                      <Package className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{produto.nome_produto}</p>
                        <p className="text-xs text-muted-foreground">
                          Código: {produto.codigo} • Lote: {produto.lote}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Quantidade: {produto.quantidade} un. • Validade: {produto.dt_validade} •
                          R$ {produto.valor_unitario.toFixed(2)}
                        </p>
                        {produto.sem_rastro && (
                          <p className="text-xs text-amber-600 font-medium">Sem rastreamento</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warnings sobre produtos sem rastreamento */}
              {warnings.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Aviso sobre rastreamento</AlertTitle>
                  <AlertDescription>
                    {warnings.length} produto(s) no XML não possuem informação de lote ({'<rastro>'}
                    ). Eles serão importados com lote &quot;NÃO_INFORMADO&quot; e validade
                    31/12/2099.
                  </AlertDescription>
                </Alert>
              )}

              {/* Warning geral */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  Ao confirmar, estes produtos serão adicionados permanentemente ao estoque da
                  clínica. Verifique se todas as informações estão corretas antes de prosseguir.
                </AlertDescription>
              </Alert>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={handleConfirmImport}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmar e Adicionar ao Estoque
                </Button>
                <Button variant="outline" onClick={resetUpload}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Confirming Status */}
        {uploadStatus === 'confirming' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Adicionando ao Estoque...
              </CardTitle>
              <CardDescription>Salvando produtos no inventário</CardDescription>
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
        {uploadStatus === 'success' && parsedData && (
          <Card className="border-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                Importação Concluída!
              </CardTitle>
              <CardDescription>NF-e {parsedData.numero} processada com sucesso</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Produtos Importados</p>
                  <p className="text-2xl font-bold text-green-600">{parsedData.produtos.length}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Número da NF</p>
                  <p className="text-2xl font-bold">{parsedData.numero}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Produtos Adicionados ao Estoque:</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {parsedData.produtos.map((produto, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Package className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{produto.nome_produto}</p>
                        <p className="text-xs text-muted-foreground">
                          Lote: {produto.lote} • {produto.quantidade} un. • Val:{' '}
                          {produto.dt_validade}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => router.push('/clinic/inventory')} className="flex-1">
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
        {uploadStatus === 'error' && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Erro na Importação
              </CardTitle>
              <CardDescription>Não foi possível processar a NF-e</CardDescription>
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
                <Button variant="outline" onClick={() => router.push('/clinic/dashboard')}>
                  Voltar ao Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
