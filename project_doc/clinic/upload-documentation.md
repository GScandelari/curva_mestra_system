# Documentação Experimental - Upload de DANFE

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clínica / Upload
**Componente:** Upload de DANFE (`/clinic/upload`)
**Versão:** 1.1
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

> **FUNCIONALIDADE DESABILITADA NO MVP.** Conforme `CLAUDE.md`, o MVP opera apenas com cadastro manual (`/clinic/add-products`). Esta página permanece no código como referência para implementação futura.

---

## 1. Visão Geral

Página para importação de produtos via upload de PDF de DANFE (Documento Auxiliar da Nota Fiscal Eletrônica). O fluxo inclui upload do arquivo, processamento OCR via API, preview dos produtos extraídos para confirmação manual e adição ao inventário. Restrita a `clinic_admin`.

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/upload/page.tsx`
- **Rota:** `/clinic/upload`
- **Layout:** Clinic Layout

### 1.2 Dependências Principais
- **useAuth:** `src/hooks/useAuth.ts` — autenticação e claims
- **FileUpload:** `src/components/upload/FileUpload` — componente customizado de upload
- **nfImportService:** `src/lib/services/nfImportService.ts` — `uploadNFFile`, `createNFImport`, `processNFAndAddToInventory`
- **Types:** `ParsedNF` de `src/types/nf`
- **Shadcn/ui:** Card, Button, Input, Label, Alert, Progress
- **Lucide Icons:** ArrowLeft, Upload, CheckCircle, AlertCircle, FileText, Package, Loader2

---

## 2. Tipos de Usuários / Atores

### 2.1 Administrador de Clínica (`clinic_admin`)
- **Descrição:** Administrador de uma clínica específica
- **Acesso:** Acesso completo ao fluxo de upload e importação
- **Comportamento:** Upload de PDF, revisão de produtos extraídos, confirmação de importação
- **Restrições:** Único role com acesso; outros roles veem mensagem de "acesso negado"

---

## 3. Estrutura de Dados

```typescript
// Tipo ParsedNF (resultado do OCR)
interface ParsedNF {
  numero_nf: string;                // Número da NF extraído
  products: Array<{
    codigo: string;                  // Código do produto
    nome_produto: string;            // Nome do produto
    lote: string;                    // Lote (fallback: "NAO_INFORMADO")
    quantidade: number;              // Quantidade (fallback: 1)
    dt_validade: string;             // Data de validade (fallback: "31/12/2099")
    valor_unitario: number;          // Valor unitário (fallback: 0.00)
  }>;
}
```

**Campos Principais:**
- **lote:** Fallback "NAO_INFORMADO" se não extraído
- **quantidade:** Fallback 1 se não extraído
- **dt_validade:** Fallback "31/12/2099" se não extraído
- **valor_unitario:** Fallback 0.00 se não extraído

---

## 4. Casos de Uso

### 4.1 UC-001: Upload e Processamento de DANFE

**Ator:** clinic_admin
**Pré-condições:**
- Usuário autenticado como `clinic_admin`
- Arquivo PDF de DANFE disponível

**Fluxo Principal:**
1. Usuário seleciona arquivo PDF via FileUpload
2. Número da NF auto-extraído do nome do arquivo (regex `\d{6,}`)
3. Usuário confirma número da NF e clica "Importar"
4. PDF enviado para Firebase Storage via `uploadNFFile`
5. Registro de importação criado em `nf_imports` via `createNFImport`
6. API `POST /api/parse-nf` processa o PDF via OCR
7. Produtos extraídos exibidos em preview para confirmação
8. Clique em "Confirmar" adiciona produtos ao inventário via `processNFAndAddToInventory`

**Fluxo Alternativo — Chave de Acesso (44 dígitos):**
1. Número extraído do nome com 44+ dígitos
2. Número da NF extraído das posições 25-33 da chave

**Fluxo Alternativo — Nenhum Produto Encontrado:**
1. OCR retorna lista vazia
2. Tela de erro exibida

**Pós-condições:**
- Produtos adicionados ao inventário
- NF registrada em `nf_imports`

---

### 4.2 UC-002: Cancelar/Tentar Novamente

**Ator:** clinic_admin
**Pré-condições:**
- Fluxo em qualquer estado

**Fluxo Principal:**
1. Clique em "Cancelar" ou "Tentar Novamente"
2. `resetUpload` limpa todos os estados
3. Retorna ao estado `idle`

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│                      UPLOAD DE DANFE                             │
│               (DESABILITADO NO MVP)                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Role ==          │
                    │ clinic_admin?    │
                    └──────────────────┘
                         │         │
                    SIM  │         │  NÃO
                         │         │
                         ▼         ▼
              ┌──────────────┐  ┌──────────────────┐
              │ IDLE:        │  │ "Acesso negado"  │
              │ FileUpload + │  └──────────────────┘
              │ Input NF     │
              └──────────────┘
                      │
                      ▼ Clique "Importar"
              ┌──────────────┐
              │ UPLOADING:   │
              │ Firebase     │
              │ Storage      │
              └──────────────┘
                      │
                      ▼
              ┌──────────────┐
              │ PROCESSING:  │
              │ API OCR      │
              │ /api/parse-nf│
              └──────────────┘
                 │         │
              OK │         │ ERRO
                 │         │
                 ▼         ▼
        ┌────────────┐  ┌────────────┐
        │ PREVIEW:   │  │ ERROR:     │
        │ Produtos   │  │ Detalhes   │
        │ extraídos  │  │ + Retry    │
        └────────────┘  └────────────┘
              │
              ▼ Confirmar
        ┌────────────┐
        │ CONFIRMING: │
        │ Salvar no  │
        │ inventário │
        └────────────┘
              │
              ▼
        ┌────────────┐
        │ SUCCESS:   │
        │ Resumo     │
        └────────────┘
```

---

## 6. Regras de Negócio

### RN-001: Acesso Restrito
**Descrição:** Apenas `clinic_admin` pode acessar a página de upload
**Aplicação:** Check de role no render — outros roles veem Alert destructive
**Exceções:** Nenhuma
**Justificativa:** Upload de NF é operação administrativa

### RN-002: Auto-Extração do Número da NF
**Descrição:** Número da NF é extraído automaticamente do nome do arquivo via regex `(\d{6,})`
**Aplicação:** Se nome contém sequência de 6+ dígitos, preenche o campo automaticamente
**Exceções:** Chave de acesso de 44 dígitos — extrai posições 25-33
**Justificativa:** UX — reduz entrada manual

### RN-003: Fallbacks para Dados Faltantes
**Descrição:** Produtos sem campos obrigatórios recebem valores padrão
**Aplicação:** lote="NAO_INFORMADO", quantidade=1, dt_validade="31/12/2099", valor_unitario=0.00
**Exceções:** Nenhuma
**Justificativa:** Garantir que todos os produtos sejam importáveis mesmo com OCR incompleto

### RN-004: Confirmação Manual Obrigatória
**Descrição:** Usuário deve revisar e confirmar os produtos extraídos antes de adicionar ao estoque
**Aplicação:** Etapa de preview obrigatória antes da confirmação
**Exceções:** Nenhuma
**Justificativa:** OCR pode ter erros — revisão humana necessária

### RN-005: Upload para Firebase Storage
**Descrição:** PDF enviado para Firebase Storage via `uploadNFFile(tenantId, file)`
**Aplicação:** Antes do processamento OCR
**Exceções:** Nenhuma
**Justificativa:** Manter cópia do arquivo original para referência

---

## 7. Estados da Interface

### 7.1 Estado: Acesso Negado
**Quando:** Usuário não é `clinic_admin`
**Exibição:** Alert destructive "Apenas administradores podem fazer upload de DANFE"

### 7.2 Estado: Idle
**Quando:** Estado inicial ou após reset
**Exibição:** Card com FileUpload + Input número NF + botões Importar/Cancelar

### 7.3 Estado: Uploading
**Quando:** Upload em andamento
**Exibição:** Barra de progresso animada (simulada: 10% a cada 300ms até 90%) + nome do arquivo

### 7.4 Estado: Processing
**Quando:** OCR em andamento
**Exibição:** 3 indicadores pulsantes: leitura, extração, validação

### 7.5 Estado: Preview
**Quando:** Produtos extraídos com sucesso
**Exibição:** Card azul com lista de produtos + resumo + alerta + botões Confirmar/Cancelar

### 7.6 Estado: Confirming
**Quando:** Salvando produtos no inventário
**Exibição:** 3 indicadores pulsantes: validação, inventário, registro

### 7.7 Estado: Success
**Quando:** Importação concluída
**Exibição:** Card verde com resumo + lista + botões "Ver Estoque" / "Nova Importação"

### 7.8 Estado: Error
**Quando:** Erro em qualquer etapa
**Exibição:** Card vermelho com detalhes + botões "Tentar Novamente" / "Voltar ao Dashboard"

---

## 8. Validações

### 8.1 Validações de Frontend
- **Arquivo:** Obrigatório (validação no componente FileUpload)
- **Número da NF:** Obrigatório e não-vazio para iniciar upload
- **tenantId / userId:** Ambos necessários para upload
- **Role:** Página bloqueada se não `clinic_admin`
- **Resultado OCR:** Deve conter ao menos 1 produto

### 8.2 Validações de Backend
- **API /api/parse-nf:** Processa PDF e retorna produtos extraídos
- **Firebase Storage:** Upload autenticado

### 8.3 Validações de Permissão
- **Role check:** Apenas `clinic_admin`
- **Multi-tenant:** Upload e dados isolados por `tenantId`

---

## 9. Integrações

### 9.1 Firebase Storage — uploadNFFile
- **Tipo:** Upload de arquivo
- **Path:** `danfe/{tenantId}/{nf_id}.pdf`
- **Quando:** Clique em "Importar"

### 9.2 Firestore — createNFImport
- **Tipo:** Escrita
- **Coleção:** `tenants/{tenantId}/nf_imports`
- **Quando:** Após upload do arquivo

### 9.3 API — POST /api/parse-nf
- **Tipo:** API Route (Next.js)
- **Payload:** FormData com o arquivo PDF
- **Retorno:** `ParsedNF` (número da NF + lista de produtos)
- **Quando:** Após criação do NF import

### 9.4 Firestore — processNFAndAddToInventory
- **Tipo:** Escrita
- **Coleção:** `tenants/{tenantId}/inventory`
- **Quando:** Confirmação do preview

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Acesso restrito a `clinic_admin`
- ✅ Upload autenticado no Firebase Storage
- ✅ Isolamento multi-tenant
- ✅ Confirmação manual antes de persistir dados
- ✅ Tratamento de erros em todas as etapas

### 10.2 Vulnerabilidades Conhecidas
- ⚠️ Funcionalidade desabilitada no MVP — não há testes atualizados
- **Mitigação:** Manter como referência, não conectar à interface

### 10.3 Dados Sensíveis
- **Arquivo PDF:** Pode conter dados fiscais sensíveis da clínica
- **NF completa:** Armazenada no Firebase Storage

---

## 11. Performance

### 11.1 Métricas
- **Upload:** Depende do tamanho do PDF
- **OCR:** Depende da complexidade do PDF (processamento server-side)
- **Requisições:** Upload + API OCR + escritas Firestore

### 11.2 Otimizações Implementadas
- ✅ Barra de progresso simulada para feedback visual
- ✅ Auto-extração do número da NF do nome do arquivo

### 11.3 Gargalos Identificados
- ⚠️ OCR pode ser lento para PDFs complexos
- ⚠️ Funcionalidade não testada no MVP atual

---

## 12. Acessibilidade

### 12.1 Conformidade WCAG
- **Nível:** A parcial
- **Versão:** 2.1

### 12.2 Recursos Implementados
- ✅ Labels nos inputs
- ✅ Alerts com ícones e texto
- ✅ Feedback visual de progresso

### 12.3 Melhorias Necessárias
- [ ] Melhorar acessibilidade do FileUpload customizado
- [ ] Adicionar aria-live para mudanças de estado

---

## 13. Testes

### 13.1 Cenários de Teste
1. **Upload e processamento completo**
   - **Dado:** PDF de DANFE válido (NF-e 026229)
   - **Quando:** Fluxo completo executado
   - **Então:** Produtos extraídos e adicionados ao inventário

2. **Auto-extração de número**
   - **Dado:** Arquivo nomeado "026229.pdf"
   - **Quando:** Arquivo selecionado
   - **Então:** Campo número da NF preenchido com "026229"

3. **Acesso negado para clinic_user**
   - **Dado:** Usuário com role `clinic_user`
   - **Quando:** Acessa `/clinic/upload`
   - **Então:** Alert "Apenas administradores podem fazer upload"

### 13.2 Casos de Teste de Erro
1. **PDF sem produtos:** Tela de erro exibida
2. **Erro de upload:** Estado error com botão "Tentar Novamente"
3. **Erro de OCR:** Estado error com detalhes

### 13.3 Testes de Integração
- [ ] Testar com NF-e 026229 (referência no CLAUDE.md)
- [ ] Testar fallbacks de dados faltantes

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Reativar funcionalidade quando MVP estiver maduro
- [ ] Edição inline dos produtos extraídos no preview
- [ ] Suporte a múltiplos PDFs em sequência
- [ ] Integração com Vertex AI Gemini como fallback de OCR

### 14.2 UX/UI
- [ ] Drag and drop para upload
- [ ] Preview visual do PDF

### 14.3 Performance
- [ ] Processamento OCR via Cloud Function (background)

### 14.4 Segurança
- [ ] Validação de tipo de arquivo (PDF only)
- [ ] Limite de tamanho de arquivo

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas/Componentes Relacionados
- **Listagem de Inventário (`/clinic/inventory`):** Destino após importação
- **API Route `/api/parse-nf`:** Processamento OCR
- **FileUpload Component:** `src/components/upload/FileUpload`

### 15.2 Fluxos que Passam por Esta Página
1. **Upload → OCR → Preview → Inventário:** Fluxo principal (desabilitado)

### 15.3 Impacto de Mudanças
- **Alto impacto:** API `/api/parse-nf`, `nfImportService`
- **Médio impacto:** `InventoryItem` (estrutura dos dados importados)
- **Baixo impacto:** Componentes UI

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **Funcionalidade desabilitada:** MVP simplificado para cadastro manual apenas
- **Estado baseado em fluxo:** Variável `status` controla toda a máquina de estados
- **Barra de progresso simulada:** `setInterval` incrementa 10% a cada 300ms para feedback

### 16.2 Padrões Utilizados
- **State machine pattern:** Status controla renderização e comportamento
- **Auto-detection pattern:** Número da NF extraído do nome do arquivo

### 16.3 Limitações Conhecidas
- ⚠️ **DESABILITADA NO MVP** — permanece como referência
- ⚠️ Função `simulateOCRProcessing` definida mas não utilizada (remanescente)
- ⚠️ API `/api/parse-nf` não está conectada à interface

### 16.4 Notas de Implementação
- Barra de progresso simulada para UX (não reflete progresso real)
- `resetUpload` limpa todos os estados para nova importação
- `extractNFNumber` trata chaves de acesso de 44 dígitos

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa (Claude) | Documentação inicial |
| 09/02/2026 | 1.1 | Engenharia Reversa (Claude) | Padronização conforme template (20 seções) |

---

## 18. Glossário

- **DANFE:** Documento Auxiliar da Nota Fiscal Eletrônica
- **OCR:** Optical Character Recognition — reconhecimento óptico de caracteres
- **NF-e:** Nota Fiscal Eletrônica
- **Chave de Acesso:** Código de 44 dígitos que identifica uma NF-e
- **ParsedNF:** Resultado estruturado da extração OCR de um PDF de DANFE

---

## 19. Referências

### 19.1 Documentação Relacionada
- Inserção Manual de Produtos - `project_doc/clinic/add-products-documentation.md`
- Listagem de Inventário - `project_doc/clinic/inventory-list-documentation.md`

### 19.2 Links Externos
- Firebase Storage - https://firebase.google.com/docs/storage

### 19.3 Código Fonte
- **Componente Principal:** `src/app/(clinic)/clinic/upload/page.tsx`
- **FileUpload:** `src/components/upload/FileUpload.tsx`
- **Services:** `src/lib/services/nfImportService.ts`
- **API Route:** `src/app/api/parse-nf/route.ts`
- **Types:** `src/types/nf.ts`

---

## 20. Anexos

### 20.1 Screenshots
[Funcionalidade desabilitada — sem screenshots disponíveis]

### 20.2 Diagramas
[Diagrama de fluxo incluído na seção 5]

### 20.3 Exemplos de Código

```typescript
// Auto-extração do número da NF do nome do arquivo
function extractNFNumber(filename: string): string {
  const match = filename.match(/(\d{6,})/);
  if (match && match[1].length >= 44) {
    // Chave de acesso completa — extrair posições 25-33
    return match[1].substring(25, 34);
  }
  return match ? match[1] : "";
}
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 09/02/2026
**Responsável:** Equipe Curva Mestra
**Revisado por:** —
**Status:** Aprovado
