"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, Edit, Loader2 } from "lucide-react";
import { LegalDocument, DocumentStatus } from "@/types";
import ReactMarkdown from "react-markdown";

export default function ViewLegalDocumentPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [document, setDocument] = useState<LegalDocument | null>(null);

  const documentId = params.id as string;

  useEffect(() => {
    if (documentId) {
      loadDocument();
    }
  }, [documentId]);

  async function loadDocument() {
    try {
      const docRef = doc(db, "legal_documents", documentId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setDocument({ id: docSnap.id, ...docSnap.data() } as LegalDocument);
      } else {
        toast({
          title: "Documento não encontrado",
          variant: "destructive",
        });
        router.push("/admin/legal-documents");
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar documento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: DocumentStatus) {
    const variants: Record<DocumentStatus, { variant: any; label: string }> = {
      ativo: { variant: "default", label: "Ativo" },
      inativo: { variant: "secondary", label: "Inativo" },
      rascunho: { variant: "outline", label: "Rascunho" },
    };

    const config = variants[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!document) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => router.push("/admin/legal-documents")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{document.title}</h1>
              {getStatusBadge(document.status)}
            </div>
            <p className="text-muted-foreground">
              Versão {document.version} • {document.slug}
            </p>
          </div>
          <Button onClick={() => router.push(`/admin/legal-documents/${documentId}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
        </div>
      </div>

      {/* Informações */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Documento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ordem</p>
              <p className="text-lg">{document.order}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <p className="text-lg">{getStatusBadge(document.status)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {document.required_for_registration && (
              <Badge variant="outline">Obrigatório no cadastro</Badge>
            )}
            {document.required_for_existing_users && (
              <Badge variant="outline">Obrigatório para usuários existentes</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo */}
      <Card>
        <CardHeader>
          <CardTitle>Conteúdo do Documento</CardTitle>
          <CardDescription>Preview do documento em Markdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none border rounded-lg p-6 bg-muted/30">
            <ReactMarkdown>{document.content}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
