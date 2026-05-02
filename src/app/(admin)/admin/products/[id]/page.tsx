'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, Package, AlertTriangle } from 'lucide-react';
import {
  getMasterProduct,
  updateMasterProduct,
  isMasterProductInUse,
} from '@/lib/services/masterProductService';
import {
  validateProductCode,
  normalizeProductName,
  MASTER_PRODUCT_CATEGORIES,
  getNomeCompletoMasterProduct,
} from '@/types/masterProduct';
import type { MasterProduct, MasterProductCategory } from '@/types/masterProduct';
import { Timestamp } from 'firebase/firestore';

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<MasterProduct | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [category, setCategory] = useState<MasterProductCategory | ''>('');
  const [fragmentavel, setFragmentavel] = useState(false);
  const [unidadesPorEmbalagem, setUnidadesPorEmbalagem] = useState<string>('');
  const [emUso, setEmUso] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const [{ product: data }, inUso] = await Promise.all([
        getMasterProduct(productId),
        isMasterProductInUse(productId),
      ]);
      setProduct(data);
      setCode(data.code);
      setName(data.name);
      setActive(data.active);
      setCategory(data.category ?? '');
      setFragmentavel(data.fragmentavel);
      setUnidadesPorEmbalagem(data.unidades_por_embalagem?.toString() ?? '');
      setEmUso(inUso);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar produto');
      console.error('Erro ao carregar produto:', err);
    } finally {
      setLoading(false);
    }
  };

  const nomeCompleto = product
    ? getNomeCompletoMasterProduct({
        ...product,
        name: normalizeProductName(name),
        fragmentavel,
        unidades_por_embalagem: fragmentavel
          ? Number(unidadesPorEmbalagem) || undefined
          : undefined,
        created_at: product.created_at ?? Timestamp.now(),
        updated_at: product.updated_at ?? Timestamp.now(),
      })
    : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!code.trim()) {
      setError('Código do produto é obrigatório');
      return;
    }

    if (!validateProductCode(code)) {
      setError('Código inválido. O código deve ter 7 dígitos.');
      return;
    }

    if (!name.trim()) {
      setError('Nome do produto é obrigatório');
      return;
    }

    if (fragmentavel && (!unidadesPorEmbalagem || Number(unidadesPorEmbalagem) < 2)) {
      setError('Produto fragmentável requer unidades por embalagem (mínimo 2)');
      return;
    }

    setSaving(true);

    try {
      await updateMasterProduct(productId, {
        code: code.trim(),
        name: normalizeProductName(name),
        active,
        category: category || undefined,
        fragmentavel,
        unidades_por_embalagem: fragmentavel ? Number(unidadesPorEmbalagem) : undefined,
      });

      setSuccess('Produto atualizado com sucesso!');
      setTimeout(() => {
        router.push('/admin/products');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar produto');
      console.error('Erro ao atualizar produto:', err);
    } finally {
      setSaving(false);
    }
  };

  const formatCodeInput = (value: string) => {
    return value.replace(/\D/g, '').slice(0, 7);
  };

  if (loading) {
    return (
      <div className="container py-8 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando produto...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container py-8 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">Produto não encontrado</p>
          <Button asChild>
            <Link href="/admin/products">Voltar para Produtos</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-8 w-8 text-primary" />
            Editar Produto
          </h1>
          <p className="text-muted-foreground">Atualize as informações do produto</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informações do Produto</CardTitle>
            <CardDescription>Edite os dados do produto</CardDescription>
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
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as MasterProductCategory)}
                  disabled={saving}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {MASTER_PRODUCT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 rounded-md border p-4">
                {emUso && (
                  <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      Este produto está em uso no inventário de clínicas. As configurações de
                      fragmentação não podem ser alteradas.
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="fragmentavel">Produto Fragmentável</Label>
                    <p className="text-xs text-muted-foreground">
                      Vendido em embalagem com múltiplas unidades (ex: caixa com 60 fios)
                    </p>
                  </div>
                  <Switch
                    id="fragmentavel"
                    checked={fragmentavel}
                    onCheckedChange={(v) => {
                      setFragmentavel(v);
                      if (!v) setUnidadesPorEmbalagem('');
                    }}
                    disabled={saving || emUso}
                  />
                </div>

                {fragmentavel && (
                  <div className="space-y-2 pt-2 border-t">
                    <Label htmlFor="unidades">
                      Unidades por Embalagem <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="unidades"
                      type="number"
                      min={2}
                      step={1}
                      value={unidadesPorEmbalagem}
                      onChange={(e) => setUnidadesPorEmbalagem(e.target.value)}
                      placeholder="Ex: 60"
                      disabled={saving || emUso}
                    />
                  </div>
                )}
              </div>

              {name.trim() && (
                <div className="rounded-md bg-muted p-3 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">
                    Pré-visualização do nome
                  </p>
                  <p className="text-sm font-mono font-semibold">{nomeCompleto}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Status do Produto</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={active ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActive(true)}
                    disabled={saving}
                  >
                    Ativo
                  </Button>
                  <Button
                    type="button"
                    variant={!active ? 'default' : 'outline'}
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
                <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">{success}</div>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/admin/products')}
                  disabled={saving}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving} className="flex-1">
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
