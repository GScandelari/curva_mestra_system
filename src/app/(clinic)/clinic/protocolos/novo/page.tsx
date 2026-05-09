'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtocoloForm } from '@/components/protocolos/ProtocoloForm';
import {
  getHistoricalProducts,
  createProtocolo,
  type ProdutoHistorico,
} from '@/lib/services/protocoloService';
import type { ProtocoloItem } from '@/types';

export default function NovoProtocoloPage() {
  const { user, claims } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const tenantId = claims?.tenant_id;

  useEffect(() => {
    if (claims && claims.role !== 'clinic_admin') {
      router.push('/clinic/protocolos');
    }
  }, [claims, router]);

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [itens, setItens] = useState<ProtocoloItem[]>([]);
  const [produtosHistoricos, setProdutosHistoricos] = useState<ProdutoHistorico[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    getHistoricalProducts(tenantId)
      .then(setProdutosHistoricos)
      .catch(() => toast({ title: 'Erro ao carregar produtos', variant: 'destructive' }));
  }, [tenantId, toast]);

  async function handleSubmit() {
    if (!tenantId || !user) return;
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
      await createProtocolo(tenantId, user.uid, {
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        itens,
      });
      toast({ title: 'Protocolo criado com sucesso!' });
      router.push('/clinic/protocolos');
    } catch {
      toast({ title: 'Erro ao criar protocolo', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
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
            Novo Protocolo
          </h1>
          <p className="text-muted-foreground">
            Defina um conjunto de produtos para um procedimento recorrente
          </p>
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
          submitLabel="Criar Protocolo"
        />
      </div>
    </div>
  );
}
