'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtocoloForm } from '@/components/protocolos/ProtocoloForm';
import {
  getHistoricalProducts,
  updateProtocolo,
  listProtocolos,
  type ProdutoHistorico,
} from '@/lib/services/protocoloService';
import type { Protocolo, ProtocoloItem } from '@/types';

export default function EditarProtocoloPage() {
  const { claims } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const tenantId = claims?.tenant_id;
  const id = params.id as string;

  useEffect(() => {
    if (claims && claims.role !== 'clinic_admin') {
      router.push('/clinic/protocolos');
    }
  }, [claims, router]);

  const [protocolo, setProtocolo] = useState<Protocolo | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [itens, setItens] = useState<ProtocoloItem[]>([]);
  const [produtosHistoricos, setProdutosHistoricos] = useState<ProdutoHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId || !id) return;
    Promise.all([listProtocolos(tenantId), getHistoricalProducts(tenantId)])
      .then(([protocolos, historicos]) => {
        const found = protocolos.find((p) => p.id === id);
        if (!found) {
          toast({ title: 'Protocolo não encontrado', variant: 'destructive' });
          router.push('/clinic/protocolos');
          return;
        }
        setProtocolo(found);
        setNome(found.nome);
        setDescricao(found.descricao ?? '');
        setItens(found.itens);
        setProdutosHistoricos(historicos);
      })
      .catch(() => toast({ title: 'Erro ao carregar protocolo', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [tenantId, id, router, toast]);

  async function handleSubmit() {
    if (!tenantId) return;
    if (!nome.trim()) {
      toast({ title: 'Informe o nome do protocolo', variant: 'destructive' });
      return;
    }
    if (itens.length === 0) {
      toast({ title: 'Adicione ao menos um produto', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await updateProtocolo(tenantId, id, {
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        itens,
      });
      toast({ title: 'Protocolo atualizado com sucesso!' });
      router.push('/clinic/protocolos');
    } catch {
      toast({ title: 'Erro ao atualizar protocolo', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container py-8 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="space-y-6">
        <div>
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => router.push('/clinic/protocolos')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-8 w-8 text-primary" />
            Editar Protocolo
          </h1>
          <p className="text-muted-foreground">{protocolo?.nome}</p>
        </div>

        <ProtocoloForm
          nome={nome}
          descricao={descricao}
          itens={itens}
          produtosHistoricos={produtosHistoricos}
          saving={saving}
          onNomeChange={setNome}
          onDescricaoChange={setDescricao}
          onItensChange={setItens}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/clinic/protocolos')}
          submitLabel="Salvar Alterações"
        />
      </div>
    </div>
  );
}
