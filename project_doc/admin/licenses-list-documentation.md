# Documentação Experimental - Licenças (Lista)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Lista de Licenças (`/admin/licenses`)
**Versão:** 1.1
**Data:** 10/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página que lista todas as licenças do sistema com cards de estatísticas e tabela detalhada. Exibe status com ícones coloridos, dias restantes, plano e renovação automática. Utiliza o `licenseService` para buscar dados e permite navegação para detalhes e criação de novas licenças.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/licenses/page.tsx`
- **Rota:** `/admin/licenses`
- **Layout:** Admin Layout
- **Permissão:** Super Admin

### 1.2 Dependências
- **licenseService:** `getAllLicenses()`, `getDaysUntilExpiration()`
- **Types:** `License`
- **Lucide Icons:** CheckCircle, XCircle, Clock, AlertTriangle
- **Components:** Card, Badge, Button, Table

### 1.3 Propósito
Fornecer uma visão consolidada de todas as licenças do sistema, permitindo monitoramento de status, expiração e renovação automática. Facilita a gestão centralizada de licenças de todos os tenants.

---

## 2. Tipos de Usuários/Atores

### 2.1 Super Admin
- **Permissões:** Acesso total
- **Ações:** Visualizar todas as licenças, criar novas, editar, suspender, reativar
- **Contexto:** Gerencia licenças de todos os tenants do sistema

### 2.2 Sistema Automatizado
- **Permissões:** Leitura e atualização de status
- **Ações:** Verificar expiração, processar renovações automáticas, enviar notificações
- **Contexto:** Executa tarefas agendadas de manutenção de licenças

---

## 3. Estrutura de Dados

### 3.1 Interface License
```typescript
interface License {
  id: string;
  tenantId: string;
  tenantName: string;
  plan: 'basico' | 'profissional' | 'empresarial' | 'personalizado';
  status: 'ativa' | 'expirada' | 'suspensa' | 'pendente';
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  maxUsers?: number;
  maxStorage?: number; // em GB
  features: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.2 Interface LicenseStats
```typescript
interface LicenseStats {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
}
```

### 3.3 Tipos de Planos
```typescript
type PlanType = 'basico' | 'profissional' | 'empresarial' | 'personalizado';

const PLAN_LABELS: Record<PlanType, string> = {
  basico: 'Básico',
  profissional: 'Profissional',
  empresarial: 'Empresarial',
  personalizado: 'Personalizado'
};
```

---

## 4. Casos de Uso

### 4.1 Listar Todas as Licenças
**Ator:** Super Admin
**Fluxo:**
1. Acessa `/admin/licenses`
2. Sistema carrega todas as licenças via `getAllLicenses()`
3. Exibe cards de estatísticas e tabela
4. Permite ordenação e filtros

**Service:** `getAllLicenses()` retorna `License[]`

### 4.2 Visualizar Estatísticas
**Ator:** Super Admin
**Fluxo:**
1. Sistema calcula estatísticas em tempo real
2. Exibe cards com totais de licenças por status
3. Destaca licenças expirando em breve (≤ 15 dias)

### 4.3 Criar Nova Licença
**Ator:** Super Admin
**Fluxo:**
1. Clica em "Nova Licença"
2. Navega para `/admin/licenses/new`
3. Preenche formulário de criação

**Ação:** Botão "Nova Licença" → `/admin/licenses/new`

### 4.4 Ver Detalhes da Licença
**Ator:** Super Admin
**Fluxo:**
1. Clica em uma linha da tabela ou botão "Ver Detalhes"
2. Navega para `/admin/licenses/{id}`
3. Visualiza informações completas e histórico

**Ação:** Click na linha → `/admin/licenses/{id}`

### 4.5 Filtrar Licenças por Status
**Ator:** Super Admin
**Fluxo:**
1. Seleciona filtro de status (ativa, expirada, suspensa, pendente)
2. Sistema filtra tabela em tempo real
3. Estatísticas são recalculadas

### 4.6 Ordenar Licenças
**Ator:** Super Admin
**Fluxo:**
1. Clica em cabeçalho de coluna (Tenant, Plano, Status, Data)
2. Sistema ordena tabela ascendente/descendente
3. Indicador visual mostra direção da ordenação

### 4.7 Identificar Licenças Críticas
**Ator:** Super Admin
**Fluxo:**
1. Visualiza card "Expirando em Breve"
2. Identifica licenças com ≤ 15 dias
3. Toma ação preventiva (renovação, contato com tenant)

### 4.8 Monitorar Renovações Automáticas
**Ator:** Super Admin
**Fluxo:**
1. Visualiza coluna "Renovação Automática"
2. Identifica licenças sem renovação automática próximas da expiração
3. Contata tenant para renovação manual

---

## 5. Fluxo de Processo

```
┌─────────────────────────────────────────────────────────────┐
│                    LISTA DE LICENÇAS                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Carregar Licenças                                       │
│     └─> licenseService.getAllLicenses()                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Calcular Estatísticas                                   │
│     ├─> Total de Licenças                                   │
│     ├─> Licenças Ativas                                     │
│     ├─> Expirando em Breve (≤ 15 dias)                      │
│     └─> Licenças Expiradas                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Renderizar Cards de Estatísticas                        │
│     └─> Exibir totais com cores indicativas                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Renderizar Tabela                                       │
│     ├─> Calcular dias restantes para cada licença          │
│     ├─> Aplicar cores de status                            │
│     └─> Habilitar navegação para detalhes                  │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
┌──────────────────────┐   ┌──────────────────────┐
│  Nova Licença        │   │  Ver Detalhes        │
│  /licenses/new       │   │  /licenses/{id}      │
└──────────────────────┘   └──────────────────────┘
```

---

## 6. Regras de Negócio

### 6.1 Cálculo de Dias Restantes
- Dias restantes = `endDate - hoje`
- Se dias < 0: licença expirada
- Se 0 < dias ≤ 15: expirando em breve
- Se dias > 15: normal

### 6.2 Status de Licença
- **Ativa:** `endDate` no futuro e não suspensa
- **Expirada:** `endDate` no passado
- **Suspensa:** Manualmente suspensa por admin
- **Pendente:** Aguardando ativação ou pagamento

### 6.3 Cores de Status
- Verde: Ativa com > 15 dias
- Laranja: Ativa com ≤ 15 dias ou Suspensa
- Vermelho: Expirada
- Amarelo: Pendente

### 6.4 Renovação Automática
- Se `autoRenew = true`: sistema renova automaticamente na data de expiração
- Se `autoRenew = false`: requer renovação manual

### 6.5 Ordenação Padrão
- Ordenar por dias restantes (ascendente)
- Licenças expirando primeiro aparecem no topo

### 6.6 Permissões de Acesso
- Apenas Super Admins podem acessar esta página
- Admins de tenant não têm acesso à lista completa

---

## 7. Estados da Interface

### 7.1 Loading
- Skeleton loaders nos cards de estatísticas
- Skeleton table com 5 linhas
- Botão "Nova Licença" desabilitado

### 7.2 Carregado com Dados
- Cards exibem números reais
- Tabela populada com licenças
- Botão "Nova Licença" habilitado
- Linhas clicáveis

### 7.3 Vazio (Sem Licenças)
- Mensagem: "Nenhuma licença cadastrada"
- Botão "Criar Primeira Licença"
- Cards mostram zeros

### 7.4 Erro ao Carregar
- Mensagem de erro amigável
- Botão "Tentar Novamente"
- Cards desabilitados

### 7.5 Filtrado
- Tabela mostra apenas licenças filtradas
- Estatísticas refletem filtro aplicado
- Indicador visual de filtro ativo

---

## 8. Validações

### 8.1 Validações de Frontend
- Verificar permissão de Super Admin antes de renderizar
- Validar formato de datas antes de calcular dias restantes
- Garantir que `tenantId` existe antes de navegar para detalhes

### 8.2 Validações de Backend
- `getAllLicenses()` deve retornar apenas licenças válidas
- Verificar autenticação e autorização
- Validar integridade de dados (datas, status)

### 8.3 Validações de Permissões
- Apenas Super Admins podem acessar `/admin/licenses`
- Redirecionar usuários não autorizados para dashboard apropriado
- Logs de acesso para auditoria

---

## 9. Integrações

### 9.1 licenseService
- **Método:** `getAllLicenses()`
- **Retorno:** `Promise<License[]>`
- **Uso:** Buscar todas as licenças do sistema

### 9.2 licenseService
- **Método:** `getDaysUntilExpiration(endDate: Date)`
- **Retorno:** `number`
- **Uso:** Calcular dias restantes até expiração

### 9.3 Navegação
- **Next.js Router:** Navegação para `/admin/licenses/new` e `/admin/licenses/{id}`
- **Link Component:** Links clicáveis em linhas da tabela

### 9.4 Notificações (Futuro)
- Integração com sistema de notificações para alertas de expiração
- Emails automáticos para tenants com licenças expirando

---

## 10. Segurança

### 10.1 Autenticação
- Verificar sessão ativa de Super Admin
- Redirecionar para login se não autenticado

### 10.2 Autorização
- Apenas Super Admins podem acessar esta rota
- Middleware de verificação de role

### 10.3 Proteção de Dados
- Não expor informações sensíveis de pagamento na lista
- Logs de acesso para auditoria

### 10.4 Rate Limiting
- Limitar requisições de `getAllLicenses()` para prevenir abuso
- Cache de dados para reduzir carga no servidor

---

## 11. Performance

### 11.1 Otimizações
- Cache de licenças no cliente (5 minutos)
- Paginação para grandes volumes (> 100 licenças)
- Lazy loading de dados não críticos

### 11.2 Métricas
- Tempo de carregamento inicial: < 1s
- Tempo de renderização da tabela: < 500ms
- Tempo de cálculo de estatísticas: < 100ms

### 11.3 Estratégias
- Server-side rendering para primeira carga
- Client-side filtering e sorting para melhor UX
- Debounce em filtros de busca

---

## 12. Acessibilidade

### 12.1 Navegação por Teclado
- Tab para navegar entre cards, botões e linhas da tabela
- Enter para abrir detalhes da licença
- Esc para limpar filtros

### 12.2 Screen Readers
- Labels descritivos em todos os elementos
- ARIA labels para ícones de status
- Anúncio de mudanças em estatísticas

### 12.3 Contraste e Cores
- Cores de status com contraste adequado (WCAG AA)
- Não depender apenas de cor para indicar status (usar ícones)
- Modo escuro compatível

---

## 13. Testes

### 13.1 Testes Unitários
```typescript
describe('LicensesListPage', () => {
  it('deve carregar e exibir todas as licenças', async () => {
    // Mock getAllLicenses
    // Renderizar componente
    // Verificar se licenças são exibidas
  });

  it('deve calcular estatísticas corretamente', () => {
    // Mock de licenças com diferentes status
    // Verificar contagem de ativas, expiradas, expirando
  });

  it('deve navegar para detalhes ao clicar em linha', () => {
    // Simular click em linha
    // Verificar navegação para /admin/licenses/{id}
  });
});
```

### 13.2 Testes de Integração
- Testar integração com `licenseService`
- Verificar cálculo correto de dias restantes
- Testar filtros e ordenação

### 13.3 Testes E2E
- Fluxo completo: login → lista → detalhes
- Criar nova licença e verificar aparição na lista
- Testar responsividade em diferentes dispositivos

---

## 14. Melhorias Futuras

### 14.1 Filtros Avançados
- Filtrar por plano
- Filtrar por tenant
- Filtrar por data de expiração
- Busca por nome de tenant

### 14.2 Exportação de Dados
- Exportar lista para CSV/Excel
- Relatório PDF de licenças
- Gráficos de distribuição de planos

### 14.3 Ações em Massa
- Renovar múltiplas licenças
- Suspender/reativar em lote
- Alterar plano de múltiplas licenças

### 14.4 Notificações Proativas
- Alertas automáticos para licenças expirando
- Dashboard de alertas críticos
- Integração com Slack/Teams

### 14.5 Histórico e Auditoria
- Log de todas as alterações em licenças
- Visualização de histórico de renovações
- Relatório de uso de licenças

---

## 15. Dependências e Relacionamentos

### 15.1 Dependências Diretas
- **licenseService:** Serviço principal de licenças
- **tenantService:** Para buscar informações de tenants
- **authService:** Para verificação de permissões

### 15.2 Componentes Relacionados
- `/admin/licenses/new` - Criação de licenças
- `/admin/licenses/{id}` - Detalhes da licença
- `/admin/tenants` - Gestão de tenants

### 15.3 Serviços Relacionados
- Sistema de notificações
- Sistema de pagamentos (renovação automática)
- Sistema de auditoria

---

## 16. Observações Técnicas

### 16.1 Implementação Atual
- Página server-side rendered com Next.js 14
- Uso de React Server Components para performance
- Estilização com Tailwind CSS

### 16.2 Considerações
- Paginação será necessária quando houver > 100 licenças
- Cache de licenças deve ser invalidado após criação/edição
- Considerar WebSocket para atualizações em tempo real

### 16.3 Limitações Conhecidas
- Sem paginação atualmente (pode ser lento com muitas licenças)
- Filtros básicos (apenas por status)
- Sem exportação de dados

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |
| 10/02/2026 | 1.1 | Engenharia Reversa | Expansão para template completo de 20 seções |

---

## 18. Glossário

- **Licença:** Autorização de uso do sistema para um tenant específico
- **Tenant:** Cliente/organização que utiliza o sistema
- **Plano:** Tipo de licença com recursos e limites específicos
- **Renovação Automática:** Processo de renovação de licença sem intervenção manual
- **Dias Restantes:** Número de dias até a expiração da licença
- **Super Admin:** Administrador do sistema com acesso total
- **Status:** Estado atual da licença (ativa, expirada, suspensa, pendente)

---

## 19. Referências

### 19.1 Documentação Relacionada
- `access-requests-documentation.md` - Template de referência
- `licenses-detail-documentation.md` - Detalhes de licença
- `licenses-new-documentation.md` - Criação de licença
- `tenants-list-documentation.md` - Lista de tenants

### 19.2 Código Fonte
- `src/app/(admin)/admin/licenses/page.tsx` - Componente principal
- `src/services/licenseService.ts` - Serviço de licenças
- `src/types/license.ts` - Tipos TypeScript

### 19.3 Recursos Externos
- Next.js 14 Documentation
- Tailwind CSS Documentation
- Lucide Icons Library

---

## 20. Anexos

### 20.1 Cards de Estatísticas

| Card | Valor | Cor | Ícone |
|------|-------|-----|-------|
| Total de Licenças | `licenses.length` | gray | FileText |
| Ativas | `status === "ativa"` | verde | CheckCircle |
| Expirando em Breve | Ativas com 0 < dias ≤ 15 | laranja | AlertTriangle |
| Expiradas | `status === "expirada"` | vermelho | XCircle |

### 20.2 Colunas da Tabela

1. **Tenant:** Nome do tenant (link para detalhes)
2. **Plano:** Tipo de plano (badge colorido)
3. **Status:** Ícone + badge com cor
4. **Início:** Data de início da licença
5. **Término:** Data de término da licença
6. **Dias Restantes:** Número com cor indicativa
7. **Renovação Automática:** Sim/Não (badge)
8. **Ações:** Botão "Ver Detalhes"

### 20.3 Status Visuais

**Status com ícones:**
- `ativa` → verde (CheckCircle)
- `expirada` → vermelho (XCircle)
- `suspensa` → laranja (AlertTriangle)
- `pendente` → amarelo (Clock)

**Dias Restantes:**
- Normal (> 15 dias) → verde
- Expirando (≤ 15 dias) → laranja
- Expirado (< 0) → vermelho

### 20.4 Exemplo de Dados

```typescript
const exampleLicense: License = {
  id: 'lic_123',
  tenantId: 'tenant_456',
  tenantName: 'Clínica Exemplo',
  plan: 'profissional',
  status: 'ativa',
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-12-31'),
  autoRenew: true,
  maxUsers: 10,
  maxStorage: 50,
  features: ['agendamento', 'estoque', 'financeiro'],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01')
};
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 10/02/2026
**Status:** Aprovado
