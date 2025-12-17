"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { FileText, Save, Loader2, ArrowLeft } from "lucide-react";
import { LegalDocument, DocumentStatus } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function EditLegalDocumentPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const documentId = params.id as string;

  const [formData, setFormData] = useState<Partial<LegalDocument>>({
    title: "",
    slug: "",
    content: "",
    version: "1.0",
    status: "rascunho",
    required_for_registration: false,
    required_for_existing_users: false,
    order: 1,
  });

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
        setFormData({ id: docSnap.id, ...docSnap.data() } as LegalDocument);
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

  function generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function handleTitleChange(title: string) {
    setFormData({
      ...formData,
      title,
      slug: generateSlug(title),
    });
  }

  async function handleSave() {
    if (!auth.currentUser) {
      toast({
        title: "Erro",
        description: "Você precisa estar autenticado",
        variant: "destructive",
      });
      return;
    }

    // Validações
    if (!formData.title?.trim()) {
      toast({
        title: "Erro de validação",
        description: "O título é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!formData.content?.trim()) {
      toast({
        title: "Erro de validação",
        description: "O conteúdo é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!formData.version?.trim()) {
      toast({
        title: "Erro de validação",
        description: "A versão é obrigatória",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const docRef = doc(db, "legal_documents", documentId);

      const updateData: any = {
        title: formData.title,
        slug: formData.slug || generateSlug(formData.title!),
        content: formData.content,
        version: formData.version,
        status: formData.status,
        required_for_registration: formData.required_for_registration,
        required_for_existing_users: formData.required_for_existing_users,
        order: formData.order,
        updated_at: serverTimestamp(),
      };

      // Se mudou para ativo, atualizar published_at
      if (formData.status === "ativo") {
        updateData.published_at = serverTimestamp();
      }

      await updateDoc(docRef, updateData);

      toast({
        title: "Sucesso",
        description: "Documento atualizado com sucesso",
      });

      router.push("/admin/legal-documents");
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
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
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
        <div className="flex items-center gap-3 mb-2">
          <FileText className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Editar Documento Legal</h1>
        </div>
        <p className="text-muted-foreground">
          Atualize as informações do documento
        </p>
      </div>

      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Documento</CardTitle>
          <CardDescription>
            Edite os dados do documento legal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Título */}
          <div className="grid gap-2">
            <Label htmlFor="title">
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Ex: Termos de Uso"
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
            />
          </div>

          {/* Slug */}
          <div className="grid gap-2">
            <Label htmlFor="slug">Slug (URL amigável)</Label>
            <Input
              id="slug"
              placeholder="Ex: termos-de-uso"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            />
            <p className="text-sm text-muted-foreground">
              Gerado automaticamente a partir do título
            </p>
          </div>

          {/* Versão e Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="version">
                Versão <span className="text-destructive">*</span>
              </Label>
              <Input
                id="version"
                placeholder="Ex: 1.0"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: DocumentStatus) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ordem */}
          <div className="grid gap-2">
            <Label htmlFor="order">Ordem de Exibição</Label>
            <Input
              id="order"
              type="number"
              min="1"
              value={formData.order}
              onChange={(e) =>
                setFormData({ ...formData, order: parseInt(e.target.value) || 1 })
              }
            />
            <p className="text-sm text-muted-foreground">
              Ordem em que o documento aparecerá na lista
            </p>
          </div>

          {/* Conteúdo */}
          <div className="grid gap-2">
            <Label htmlFor="content">
              Conteúdo <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="content"
              placeholder="Digite o conteúdo do documento em Markdown..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={15}
              className="font-mono text-sm"
            />
            <p className="text-sm text-muted-foreground">
              Suporta Markdown para formatação
            </p>
          </div>

          {/* Opções */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="required_registration">Obrigatório no cadastro</Label>
                <p className="text-sm text-muted-foreground">
                  Novos usuários devem aceitar este documento
                </p>
              </div>
              <Switch
                id="required_registration"
                checked={formData.required_for_registration}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, required_for_registration: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="required_existing">Obrigatório para usuários existentes</Label>
                <p className="text-sm text-muted-foreground">
                  Usuários já cadastrados devem aceitar no próximo login
                </p>
              </div>
              <Switch
                id="required_existing"
                checked={formData.required_for_existing_users}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, required_for_existing_users: checked })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push("/admin/legal-documents")}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Alterações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
