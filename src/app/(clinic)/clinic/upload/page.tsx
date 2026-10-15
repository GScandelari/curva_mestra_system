'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUpload } from '@/components/upload/FileUpload';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { TipoNotaBadge } from '@/components/inventory/TipoNotaBadge';
import { ArrowLeft, Upload, CheckCircle, AlertCircle, Package, Loader2 } from 'lucide-react';
import { getMasterProductByCode } from '@/lib/services/masterProductService';
import { formatNFLabel } from '@/lib/nfIdentity';
import { listOutOfPatternCodes } from '@/lib/nfImportPlanner';
import type { ParsedNF, XmlParseError } from '@/types/nf';

interface PendenteResultado {
  codigo: string;
  nome_produto: string;
  lote: string;
  fora_do_padrao?: boolean;
}

interface ImportResult {
  importId: string;
  idLabel: string;
  produtosImportados: number;
  pendentes: PendenteResultado[];
  arquivoSalvo: boolean;
}

const TEXTO_PENDENTES =
  'O Administrador do Sistema foi informado e atuará assim que possível. Quando o cadastro for concluído ou recusado, você será avisado pelo sino de notificações.';
const TEXTO_FORA_DO_PADRAO =
  'O código destes produtos não segue o padrão do catálogo Rennova. Eles não entrarão no estoque. O Administrador do Sistema foi informado e atuará assim que possível. Se o item for recusado, você será avisado pelo sino de notificações.';

function listaPendentes(itens: PendenteResultado[]) {
  return (
    <ul className="list-disc pl-5">
      {itens.map((p, i) => (
        <li key={`${p.codigo}-${p.lote}-${i}`}>
          {p.codigo} — {p.nome_produto} (lote {p.lote})
        </li>
      ))}
    </ul>
  );
}

export default function UploadPage() {
  const { user, claims } = useAuth();
  const router = useRouter();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'processing' | 'preview' | 'confirming' | 'success' | 'error'
  >('idle');
  const [error, setError] = useState('');
  const [parsedData, setParsedData] = useState<ParsedNF | null>(null);
  const [warnings, setWarnings] = useState<XmlParseError[]>([]);
  // Códigos fora do catálogo (ou inativos): ficarão pendentes na confirmação
  const [codigosSemCatalogo, setCodigosSemCatalogo] = useState<Set<string>>(new Set());
  // Códigos fora do padrão do catálogo (5 a 8 dígitos): pendentes, nunca incorporados
  const [codigosForaDoPadrao, setCodigosForaDoPadrao] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<ImportResult | null>(null);
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

  /**
   * "Importar NF-e" só LÊ o XML e mostra o preview — nada é gravado. A gravação
   * acontece na confirmação, numa transação no servidor (UC-10-RN-15).
   */
  const handleUpload = async () => {
    if (!selectedFile || !user) {
      setError('Arquivo não selecionado ou usuário não autenticado');
      return;
    }

    try {
      setUploading(true);
      setError('');
      setUploadStatus('processing');

      const formData = new FormData();
      formData.append('file', selectedFile);
      // Sem Content-Type manual: o navegador define o boundary do multipart.
      const idToken = await user.getIdToken();
      const response = await fetch('/api/parse-nf-xml', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
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

      const foraDoPadrao = new Set(listOutOfPatternCodes(parseResult.parsedNF.produtos));
      // O catálogo só é consultado para os códigos no padrão
      const codigos = Array.from(
        new Set(
          parseResult.parsedNF.produtos.map((p) => p.codigo).filter((c) => !foraDoPadrao.has(c))
        )
      );
      const consultas = await Promise.all(codigos.map((c) => getMasterProductByCode(c)));
      setCodigosForaDoPadrao(foraDoPadrao);
      setCodigosSemCatalogo(
        new Set(codigos.filter((_, i) => !consultas[i].product || !consultas[i].product.active))
      );

      setParsedData(parseResult.parsedNF);
      setWarnings(parseResult.warnings ?? []);
      setUploadStatus('preview');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar o XML da NF-e';
      setError(msg);
      setUploadStatus('error');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedData || !selectedFile || !user) {
      setError('Dados não disponíveis para confirmação');
      return;
    }

    try {
      setUploadStatus('confirming');
      setError('');

      const formData = new FormData();
      formData.append('file', selectedFile);
      const idToken = await user.getIdToken();
      const response = await fetch('/api/nf-imports/xml', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });
      const body = (await response.json()) as ImportResult & { error?: string };

      if (!response.ok) {
        setError(body.error ?? 'Erro ao importar a NF-e');
        setUploadStatus('error');
        return;
      }

      setResultado(body);
      setUploadStatus('success');
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
    setParsedData(null);
    setWarnings([]);
    setCodigosSemCatalogo(new Set());
    setCodigosForaDoPadrao(new Set());
    setResultado(null);
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
                Revise os produtos extraídos antes de adicionar ao estoque —{' '}
                {formatNFLabel({
                  numero: parsedData.numero,
                  serie: parsedData.serie,
                  cnpj: parsedData.cnpj_fornecedor,
                })}
                {parsedData.fornecedor ? ` · ${parsedData.fornecedor}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Produtos Encontrados</p>
                  <p className="text-2xl font-bold text-blue-600">{parsedData.produtos.length}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Número da NF</p>
                  <p className="text-2xl font-bold">{parsedData.numero}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Natureza da Operação</p>
                  <TipoNotaBadge tipoNota={parsedData.tipo_nota} />
                </div>
              </div>

              {(parsedData.natureza_operacao || parsedData.forma_pagamento) && (
                <div className="text-sm text-muted-foreground space-y-0.5">
                  {parsedData.natureza_operacao && <p>NF-e: {parsedData.natureza_operacao}</p>}
                  {parsedData.forma_pagamento && (
                    <p>Forma de pagamento: {parsedData.forma_pagamento}</p>
                  )}
                </div>
              )}

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
                      {codigosSemCatalogo.has(produto.codigo) && (
                        <Badge variant="outline" className="flex-shrink-0">
                          Não cadastrado — ficará pendente
                        </Badge>
                      )}
                      {codigosForaDoPadrao.has(produto.codigo) && (
                        <Badge
                          variant="outline"
                          className="flex-shrink-0 border-amber-400 bg-amber-50 text-amber-800"
                        >
                          Código fora do padrão — ficará pendente
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {codigosSemCatalogo.size > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Produtos fora do catálogo</AlertTitle>
                  <AlertDescription>
                    Estes produtos não entrarão no estoque agora. {TEXTO_PENDENTES}
                  </AlertDescription>
                </Alert>
              )}

              {codigosForaDoPadrao.size > 0 && (
                <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Códigos fora do padrão</AlertTitle>
                  <AlertDescription>{TEXTO_FORA_DO_PADRAO}</AlertDescription>
                </Alert>
              )}

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
        {uploadStatus === 'success' && parsedData && resultado && (
          <Card className="border-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                Importação concluída — {resultado.idLabel}
              </CardTitle>
              <CardDescription>
                {formatNFLabel({
                  numero: parsedData.numero,
                  serie: parsedData.serie,
                  cnpj: parsedData.cnpj_fornecedor,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Produtos Importados</p>
                  <p className="text-2xl font-bold text-green-600">
                    {resultado.produtosImportados}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Registro</p>
                  <p className="text-2xl font-bold">{resultado.idLabel}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Natureza da Operação</p>
                  <TipoNotaBadge tipoNota={parsedData.tipo_nota} />
                </div>
              </div>

              <p className="text-sm">
                {resultado.produtosImportados} produto(s) adicionado(s) ao estoque.
              </p>

              {resultado.pendentes.some((p) => !p.fora_do_padrao) && (
                <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Produtos não importados</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>
                      Os produtos{' '}
                      {new Intl.ListFormat('pt-BR').format(
                        resultado.pendentes
                          .filter((p) => !p.fora_do_padrao)
                          .map((p) => p.nome_produto)
                      )}{' '}
                      não foram inseridos no estoque. {TEXTO_PENDENTES}
                    </p>
                    {listaPendentes(resultado.pendentes.filter((p) => !p.fora_do_padrao))}
                  </AlertDescription>
                </Alert>
              )}

              {resultado.pendentes.some((p) => p.fora_do_padrao) && (
                <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Códigos fora do padrão</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>{TEXTO_FORA_DO_PADRAO}</p>
                    {listaPendentes(resultado.pendentes.filter((p) => p.fora_do_padrao))}
                  </AlertDescription>
                </Alert>
              )}

              {!resultado.arquivoSalvo && (
                <p className="text-xs text-muted-foreground">
                  O arquivo XML não pôde ser arquivado; a importação foi concluída normalmente.
                </p>
              )}

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
