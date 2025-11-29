"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Save, Package } from "lucide-react";
import { createMasterProduct } from "@/lib/services/masterProductService";
import { validateProductCode, normalizeProductName } from "@/types/masterProduct";

export default function NewProductPage() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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

    setLoading(true);

    try {
      await createMasterProduct({
        code: code.trim(),
        name: normalizeProductName(name),
      });

      router.push("/admin/products");
    } catch (err: any) {
      setError(err.message || "Erro ao criar produto");
      console.error("Erro ao criar produto:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCodeInput = (value: string) => {
    return value.replace(/\D/g, "").slice(0, 7);
  };

  return (
    <div className="container max-w-2xl py-8">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Package className="h-8 w-8 text-primary" />
                Novo Produto Rennova
              </h1>
              <p className="text-muted-foreground">
                Cadastre um novo produto do catálogo Rennova
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Informações do Produto</CardTitle>
                <CardDescription>
                  Preencha os dados do produto
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
                      disabled={loading}
                      maxLength={7}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Código com 7 dígitos
                    </p>
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
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      O nome será convertido para MAIÚSCULAS automaticamente
                    </p>
                  </div>

                  {error && (
                    <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push("/admin/products")}
                      disabled={loading}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading} className="flex-1">
                      <Save className="mr-2 h-4 w-4" />
                      {loading ? "Criando..." : "Criar Produto"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
    </div>
  );
}
