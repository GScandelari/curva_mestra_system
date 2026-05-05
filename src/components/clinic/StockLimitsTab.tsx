'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pencil, Check, X, Package } from 'lucide-react';
import {
  listInventory,
  getStockLimitsMap,
  updateStockLimit,
} from '@/lib/services/inventoryService';
import { agruparProdutosPorCodigo, type ProdutoAgrupado } from '@/lib/inventoryUtils';

export default function StockLimitsTab() {
  const { claims } = useAuth();
  const tenantId = claims?.tenant_id;

  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<ProdutoAgrupado[]>([]);
  const [limitsMap, setLimitsMap] = useState<Map<string, number>>(new Map());
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    async function load() {
      setLoading(true);
      try {
        const [items, limits] = await Promise.all([
          listInventory(tenantId!),
          getStockLimitsMap(tenantId!),
        ]);
        setProdutos(agruparProdutosPorCodigo(items));
        setLimitsMap(limits);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tenantId]);

  const handleEdit = (codigo: string) => {
    setEditValue(String(limitsMap.get(codigo) ?? 10));
    setEditingCode(codigo);
  };

  const handleSave = async (codigo: string) => {
    if (!tenantId) return;
    const valor = parseInt(editValue, 10);
    if (isNaN(valor) || valor < 0) return;

    setSaving(true);
    try {
      await updateStockLimit(tenantId, codigo, valor);
      setLimitsMap((prev) => new Map(prev).set(codigo, valor));
      setEditingCode(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => setEditingCode(null);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (produtos.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">Nenhum produto em estoque</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Limite de Estoque por Produto</CardTitle>
        <CardDescription>
          Define a quantidade mínima para cada produto. Abaixo ou igual ao limite, o produto aparece
          como &quot;Estoque Baixo&quot; e gera alertas de notificação.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd. em Estoque</TableHead>
                <TableHead className="text-right w-48">Limite (≤ X = Baixo)</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.map((produto) => {
                const limite = limitsMap.get(produto.codigo_produto) ?? 10;
                const isEditing = editingCode === produto.codigo_produto;

                return (
                  <TableRow key={produto.codigo_produto}>
                    <TableCell className="font-mono text-xs">{produto.codigo_produto}</TableCell>
                    <TableCell className="font-medium">{produto.nome_produto}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {produto.quantidade_total}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex justify-end">
                          <Input
                            type="number"
                            min={0}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-8 w-24"
                            disabled={saving}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSave(produto.codigo_produto);
                              if (e.key === 'Escape') handleCancel();
                            }}
                          />
                        </div>
                      ) : (
                        <span className="font-medium">{limite}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleSave(produto.codigo_produto)}
                            disabled={saving}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={handleCancel}
                            disabled={saving}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleEdit(produto.codigo_produto)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
