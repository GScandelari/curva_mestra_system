"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { LegalDocument } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";

export default function AcceptTermsOnboardingPage() {
  const router = useRouter();
  const { user, claims } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [acceptances, setAcceptances] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) {
      loadDocuments();
    }
  }, [user]);

  async function loadDocuments() {
    if (!user) return;

    try {
      // Buscar documentos ativos e obrigatórios para registro
      const docsQuery = query(
        collection(db, "legal_documents"),
        where("status", "==", "ativo"),
        where("required_for_registration", "==", true),
        orderBy("order", "asc")
      );
      const docsSnapshot = await getDocs(docsQuery);
      const docs = docsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LegalDocument[];

      // Buscar aceitações existentes do usuário
      const acceptancesQuery = query(
        collection(db, "user_document_acceptances"),
        where("user_id", "==", user.uid)
      );
      const acceptancesSnapshot = await getDocs(acceptancesQuery);
      const acceptedDocs = new Set(
        acceptancesSnapshot.docs.map((doc) => doc.data().document_id)
      );

      // Filtrar apenas documentos não aceitos ainda
      const pendingDocs = docs.filter((doc) => !acceptedDocs.has(doc.id));

      if (pendingDocs.length === 0) {
        // Se não há documentos pendentes, ir para próxima etapa
        router.push("/clinic/setup");
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
    if (!user) {
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
          user_id: user.uid,
          document_id: doc.id,
          document_version: doc.version,
          accepted_at: serverTimestamp(),
          ip_address: null,
          user_agent: navigator.userAgent,
        });
      });

      await Promise.all(promises);

      toast({
        title: "Sucesso",
        description: "Termos aceitos com sucesso",
      });

      // Redirecionar para setup da clínica
      router.push("/clinic/setup");
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto py-12 space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-2xl">Bem-vindo ao Curva Mestra!</CardTitle>
                <CardDescription>
                  Antes de começar, você precisa aceitar nossos termos e condições
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Alert */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Por favor, leia atentamente cada documento antes de aceitar. Você pode clicar no título para visualizar o conteúdo completo.
          </AlertDescription>
        </Alert>

        {/* Documentos */}
        {documents.map((doc) => (
          <Card key={doc.id}>
            <CardHeader>
              <CardTitle className="text-xl">{doc.title}</CardTitle>
              <CardDescription>Versão {doc.version}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preview do conteúdo */}
              <div className="max-h-48 overflow-y-auto border rounded-lg p-4 bg-muted/30 prose prose-sm max-w-none">
                <ReactMarkdown>{`${doc.content.substring(0, 500)}...`}</ReactMarkdown>
              </div>

              {/* Botão para ver completo */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <FileText className="mr-2 h-4 w-4" />
                    Ler {doc.title} Completo
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[85vh]">
                  <DialogHeader>
                    <DialogTitle>{doc.title}</DialogTitle>
                    <DialogDescription>Versão {doc.version}</DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="h-[65vh] pr-4">
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{doc.content}</ReactMarkdown>
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>

              {/* Checkbox de aceitação */}
              <div className="flex items-center space-x-2 pt-4 border-t">
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
                  Li e concordo com {doc.title.toLowerCase()}
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
                  Aceitar e Continuar
                </>
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-3">
              Ao continuar, você aceita todos os documentos listados acima
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
