"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { FileText, Loader2, CheckCircle2 } from "lucide-react";
import { LegalDocument } from "@/types";
import ReactMarkdown from "react-markdown";

export default function AcceptTermsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [acceptances, setAcceptances] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadPendingDocuments();
  }, []);

  async function loadPendingDocuments() {
    if (!auth.currentUser) {
      router.push("/login");
      return;
    }

    try {
      // Buscar documentos ativos e obrigatórios
      const q = query(
        collection(db, "legal_documents"),
        where("status", "==", "ativo"),
        where("required_for_existing_users", "==", true),
        orderBy("order", "asc")
      );
      const docsSnapshot = await getDocs(q);
      const docs = docsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LegalDocument[];

      // Buscar aceitações existentes do usuário
      const acceptancesQuery = query(
        collection(db, "user_document_acceptances"),
        where("user_id", "==", auth.currentUser.uid)
      );
      const acceptancesSnapshot = await getDocs(acceptancesQuery);
      const acceptedDocs = new Set(
        acceptancesSnapshot.docs.map((doc) => doc.data().document_id)
      );

      // Filtrar apenas documentos não aceitos ainda
      const pendingDocs = docs.filter((doc) => !acceptedDocs.has(doc.id));

      if (pendingDocs.length === 0) {
        // Se não há documentos pendentes, redirecionar
        router.push("/");
        return;
      }

      setDocuments(pendingDocs);

      // Inicializar estado de aceitações
      const initialAcceptances: Record<string, boolean> = {};
      pendingDocs.forEach((doc) => {
        initialAcceptances[doc.id] = false;
      });
      setAcceptances(initialAcceptances);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar documentos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptAll() {
    if (!auth.currentUser) {
      toast({
        title: "Erro",
        description: "Você precisa estar autenticado",
        variant: "destructive",
      });
      return;
    }

    // Verificar se todos os documentos foram aceitos
    const allAccepted = documents.every((doc) => acceptances[doc.id]);
    if (!allAccepted) {
      toast({
        title: "Atenção",
        description: "Você precisa aceitar todos os documentos para continuar",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Registrar aceitação de cada documento
      const promises = documents.map(async (doc) => {
        await addDoc(collection(db, "user_document_acceptances"), {
          user_id: auth.currentUser!.uid,
          document_id: doc.id,
          document_version: doc.version,
          accepted_at: serverTimestamp(),
          ip_address: null, // Pode ser capturado via API
          user_agent: navigator.userAgent,
        });
      });

      await Promise.all(promises);

      toast({
        title: "Sucesso",
        description: "Termos aceitos com sucesso",
      });

      // Redirecionar para a página inicial
      router.push("/");
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f3ef] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f3ef] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-2xl">Aceite os Termos</CardTitle>
                <CardDescription>
                  Para continuar usando o sistema, você precisa aceitar os documentos abaixo
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Documentos */}
        {documents.map((doc) => (
          <Card key={doc.id}>
            <CardHeader>
              <CardTitle className="text-xl">{doc.title}</CardTitle>
              <CardDescription>Versão {doc.version}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Conteúdo do documento */}
              <div className="max-h-96 overflow-y-auto border rounded-lg p-4 bg-muted/30 prose prose-sm max-w-none">
                <ReactMarkdown>{doc.content}</ReactMarkdown>
              </div>

              {/* Checkbox de aceitação */}
              <div className="flex items-center space-x-2 pt-4">
                <Checkbox
                  id={`accept-${doc.id}`}
                  checked={acceptances[doc.id]}
                  onCheckedChange={(checked) =>
                    setAcceptances({ ...acceptances, [doc.id]: checked as boolean })
                  }
                />
                <label
                  htmlFor={`accept-${doc.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Li e aceito {doc.title.toLowerCase()}
                </label>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Botão de confirmação */}
        <Card>
          <CardContent className="pt-6">
            <Button
              onClick={handleAcceptAll}
              disabled={saving || !documents.every((doc) => acceptances[doc.id])}
              className="w-full"
              size="lg"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Aceitar Todos os Documentos
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
