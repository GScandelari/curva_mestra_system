'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import type { ProtocoloItem } from '@/types';
import type { ProdutoHistorico } from '@/lib/services/protocoloService';

interface ProtocoloFormProps {
  nome: string;
  descricao: string;
  itens: ProtocoloItem[];
  produtosHistoricos: ProdutoHistorico[];
  saving: boolean;
  onNomeChange: (v: string) => void;
  onDescricaoChange: (v: string) => void;
  onItensChange: (itens: ProtocoloItem[]) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}

export function ProtocoloForm({
  nome,
  descricao,
  itens,
  produtosHistoricos,
  saving,
  onNomeChange,
  onDescricaoChange,
  onItensChange,
  onSubmit,
  onCancel,
  submitLabel,
}: ProtocoloFormProps) {
  const [selectedCodigo, setSelectedCodigo] = useState('');
  const [quantidade, setQuantidade] = useState('1');

  const handleAddItem = () => {
    if (!selectedCodigo) return;
    const qty = Number.parseInt(quantidade, 10);
    if (Number.isNaN(qty) || qty <= 0) return;
    if (itens.some((i) => i.codigo_produto === selectedCodigo)) return;

    const produto = produtosHistoricos.find((p) => p.codigo_produto === selectedCodigo);
    if (!produto) return;

    onItensChange([
      ...itens,
      {
        codigo_produto: produto.codigo_produto,
        nome_produto: produto.nome_produto,
        quantidade_sugerida: qty,
      },
    ]);
    setSelectedCodigo('');
    setQuantidade('1');
  };

  const handleRemoveItem = (codigo: string) => {
    onItensChange(itens.filter((i) => i.codigo_produto !== codigo));
  };

  const handleQtyChange = (codigo: string, qty: number) => {
    onItensChange(
      itens.map((i) => (i.codigo_produto === codigo ? { ...i, quantidade_sugerida: qty } : i))
    );
  };

  const availableProdutos = produtosHistoricos.filter(
    (p) => !itens.some((i) => i.codigo_produto === p.codigo_produto)
  );

  return (
    <div className="space-y-6">
      {/* Dados do protocolo */}
      <Card>
        <CardHeader>
          <CardTitle>Dados do Protocolo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              placeholder="Ex: Bioestimulação com Elleva"
              value={nome}
              onChange={(e) => onNomeChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Input
              id="descricao"
              placeholder="Descrição livre do protocolo"
              value={descricao}
              onChange={(e) => onDescricaoChange(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Produtos */}
      <Card>
        <CardHeader>
          <CardTitle>Produtos do Protocolo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Adicionar produto */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Select value={selectedCodigo} onValueChange={setSelectedCodigo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto do inventário" />
                </SelectTrigger>
                <SelectContent>
                  {availableProdutos.map((p) => (
                    <SelectItem key={p.codigo_produto} value={p.codigo_produto}>
                      {p.nome_produto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              type="number"
              min="1"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="w-24"
              placeholder="Qtd"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAddItem}
              disabled={!selectedCodigo}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Lista de itens */}
          {itens.length > 0 ? (
            <div className="rounded-md border divide-y">
              {itens.map((item) => (
                <div key={item.codigo_produto} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 text-sm font-medium">{item.nome_produto}</div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={item.quantidade_sugerida}
                      onChange={(e) =>
                        handleQtyChange(
                          item.codigo_produto,
                          Number.parseInt(e.target.value, 10) || 1
                        )
                      }
                      className="w-20 text-center"
                    />
                    <span className="text-xs text-muted-foreground">un.</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(item.codigo_produto)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum produto adicionado. Selecione produtos do inventário histórico da clínica.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={saving || !nome.trim() || itens.length === 0}>
          {saving ? 'Salvando...' : submitLabel}
        </Button>
      </div>
    </div>
  );
}
