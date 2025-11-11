"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Save, Package } from "lucide-react";
import {
  getMasterProduct,
  updateMasterProduct,
} from "@/lib/services/masterProductService";
import { validateProductCode, normalizeProductName } from "@/types/masterProduct";
import { MasterProduct } from "@/types/masterProduct";

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<MasterProduct | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const { product: data } = await getMasterProduct(productId);
      setProduct(data);
      setCode(data.code);
      setName(data.name);
      setActive(data.active);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar produto");
      console.error("Erro ao carregar produto:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!code.trim()) {
      setError("Código do produto é obrigatório");
      return;
    }

    if (!validateProductCode(code)) {
      setError("Código inválido. O código deve ter 7 dígitos.");
      return;
    }

    if (!name.trim()) {
      setError("Nome do produto é obrigatório");
      return;
    }

    setSaving(true);

    try {
      await updateMasterProduct(productId, {
        code: code.trim(),
        name: normalizeProductName(name),
        active,
      });

      setSuccess("Produto atualizado com sucesso!");
      setTimeout(() => {
        router.push("/admin/products");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar produto");
      console.error("Erro ao atualizar produto:", err);
    } finally {
      setSaving(false);
    }
  };

  const formatCodeInput = (value: string) => {
    return value.replace(/\D/g, "").slice(0, 7);
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["system_admin"]}>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground">Carregando produto...</p>
        </div>
      </ProtectedRoute>
    );
  }

  if (!product) {
    return (
      <ProtectedRoute allowedRoles={["system_admin"]}>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-destructive">Produto não encontrado</p>
            <Button asChild>
              <Link href="/admin/products">Voltar para Produtos</Link>
            </Button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["system_admin"]}>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container flex h-16 items-center">
            <Link
              href="/admin/products"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para Produtos
            </Link>
          </div>
        </header>

        <main className="container max-w-2xl py-8">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Package className="h-8 w-8 text-primary" />
                Editar Produto
              </h1>
              <p className="text-muted-foreground">
                Atualize as informações do produto
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Informações do Produto</CardTitle>
                <CardDescription>
                  Edite os dados do produto
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">
                      Código do Produto <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="code"
                      type="text"
                      value={code}
                      onChange={(e) => setCode(formatCodeInput(e.target.value))}
                      placeholder="Ex: 9274598"
                      required
                      disabled={saving}
                      maxLength={7}
                      className="font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Nome do Produto <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: NABOTA 200U 1FR/AMP"
                      required
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Status do Produto</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={active ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActive(true)}
                        disabled={saving}
                      >
                        Ativo
                      </Button>
                      <Button
                        type="button"
                        variant={!active ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActive(false)}
                        disabled={saving}
                      >
                        Inativo
                      </Button>
                      {active ? (
                        <Badge variant="default">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                  </div>

                  {error && (
                    <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
                      {success}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push("/admin/products")}
                      disabled={saving}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saving} className="flex-1">
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
