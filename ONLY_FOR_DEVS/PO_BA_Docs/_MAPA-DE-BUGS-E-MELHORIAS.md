# Mapa de Bugs, Problemas e Pontos de Atenção — Curva Mestra

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Última Atualização:** 15/07/2026
**Autor:** uc-issues-tracker (via Claude)
**Fonte:** Casos de Uso UML em `ONLY_FOR_DEVS/PO_BA_Docs/UC-01` a `UC-49`
**Versão:** 1.0

> Backlog técnico consolidado a partir dos achados registrados em cada Caso de Uso mapeado. Serve como mapa de rastreamento para priorizar correções e melhorias — não substitui os UCs individuais, que continuam sendo a fonte de verdade detalhada de cada achado.

---

## 1. Resumo Executivo

| Severidade | Aberto | Em Correção | Corrigido (doc pendente) | Corrigido e Documentado | Descartado | Total |
|---|---|---|---|---|---|---|
| Crítica | 6 | 0 | 0 | 0 | 0 | 6 |
| Alta | 23 | 0 | 0 | 0 | 0 | 23 |
| Média | 35 | 0 | 0 | 0 | 0 | 35 |
| Baixa | 82 | 0 | 0 | 0 | 0 | 82 |
| **Total** | **146** | **0** | **0** | **0** | **0** | **146** |

Além dos 146 itens classificados por severidade, este levantamento também consolida **12 decisões de produto pendentes** (Seção 4) e **16 itens de código morto/rotas órfãs** (Seção 5), sem severidade atribuída.

**Nota sobre Status dos UCs de origem:** 11 dos 49 UCs mapeados não estão com status "Aprovado" — são, em si, um sinal de pendência: **UC-05, UC-39 e UC-40** estão "Em Revisão" (achados relevantes ainda sem decisão de produto); **UC-42, UC-43, UC-44, UC-45, UC-46, UC-47, UC-48 e UC-49** estão em "Rascunho" (módulos de Notificações, Onboarding e Portal do Consultor, investigados mas ainda não formalmente aprovados).

### Destaques (itens mais urgentes)

1. **[UC-36-RN-02 / UC-36-RN-03 — Crítica]** Editar "Função" ou "Status" de um usuário de clínica no Portal Admin (`admin/users`) **não tem nenhum efeito real de acesso** — não sincroniza custom claims nem desabilita a conta no Firebase Auth. Um System Admin pode acreditar que rebaixou ou desativou um usuário e nada muda de fato.
2. **[UC-29-RN-01 — Crítica]** "Suspender" um Consultor Rennova (`admin/consultants`) é puramente cosmético — não bloqueia login nem revoga acesso às clínicas vinculadas.
3. **[UC-43-RN-01/02 — Crítica]** A tela de Preferências de Notificação (`clinic/settings`) usa `updateDoc` em vez de `setDoc` para inicializar configurações — pode estar **permanentemente quebrada** para qualquer tenant novo, bloqueando também UC-42 (verificação de alertas).
4. **[UC-14-RN-05 — Crítica]** A ferramenta de Auditoria de Inventário (`clinic/inventory/audit`) tem uma condição de corrida real entre leitura e escrita, sem transação — pode sobrescrever silenciosamente reservas de estoque legítimas.
5. **[UC-34-RN-03 — Crítica]** Exclusão de Documento Legal é definitiva (hard delete) e não verifica se o documento já foi aceito por usuários — compromete a trilha de auditoria de compliance.
6. **[UC-35-RN-04/05/06 — Alta]** A tela "Configurações do Sistema" (`admin/settings`) é uma funcionalidade inteira desconectada: modo de manutenção, permissão de registro e tempo de sessão não têm nenhum efeito real no restante da plataforma (achados também refletidos em UC-01 e UC-04).

---

## 2. Itens Críticos e de Alta Severidade

| ID | UC de Origem | Categoria | Severidade | Resumo | Status | Módulo |
|---|---|---|---|---|---|---|
| UC-14-RN-05 | [UC-14](UC-14-auditar-e-corrigir-inconsistencias-de-inventario.md) | Bug funcional | Crítica | Condição de corrida entre a leitura da auditoria e a escrita da correção de inventário, sem transação — pode sobrescrever silenciosamente reservas legítimas feitas no intervalo. | Aberto | Inventário |
| UC-29-RN-01 | [UC-29](UC-29-editar-suspender-e-reativar-consultor.md) | Achado de segurança | Crítica | "Suspender" um consultor não bloqueia login nem revoga acesso às clínicas vinculadas — é puramente cosmético no Firestore, sem tocar Auth/claims. | Aberto | Admin — Consultores |
| UC-34-RN-03 | [UC-34](UC-34-editar-publicar-e-excluir-documento-legal.md) | Débito técnico / Compliance | Crítica | Exclusão definitiva (hard delete) de documento legal sem checar `user_document_acceptances` — compromete a trilha de auditoria de compliance. | Aberto | Admin — Documentos Legais |
| UC-36-RN-02 | [UC-36](UC-36-editar-usuario-e-alterar-status-cross-tenant.md) | Achado de segurança | Crítica | Editar "Função" de um usuário de clínica não sincroniza custom claims — mudança puramente cosmética no Firestore, sem efeito real de permissões. | Aberto | Admin — Usuários |
| UC-36-RN-03 | [UC-36](UC-36-editar-usuario-e-alterar-status-cross-tenant.md) | Achado de segurança | Crítica | Definir "Status: Inativo" não desabilita a conta no Firebase Auth nem existe rota alternativa correta — usuário "desativado" continua acessando normalmente. | Aberto | Admin — Usuários |
| UC-43-RN-01/02 | [UC-43](UC-43-configurar-preferencias-de-notificacao.md) | Bug funcional | Crítica | `initializeNotificationSettings` e o fallback de salvamento usam `updateDoc` em vez de `setDoc` — a tela pode estar permanentemente quebrada para qualquer tenant cujo documento de configurações nunca foi criado. | Aberto | Notificações e Alertas |
| UC-02-RNF-01 | [UC-02](UC-02-aprovar-solicitacao-de-acesso.md) | Achado de segurança | Alta | A rota de aprovação de solicitação de acesso não valida Bearer token — depende apenas do controle client-side do layout. | Aberto | Admin — Acesso |
| UC-04-Q3 | [UC-04](UC-04-fazer-login-com-redirecionamento-por-papel.md) | Achado de segurança | Alta | `ProtectedRoute` não verifica `requirePasswordChange` nem status de clínica suspensa para uma sessão já autenticada navegando direto — bypass da troca de senha obrigatória e do bloqueio de clínica suspensa. | Aberto | Autenticação |
| UC-09-RN-02 | [UC-09](UC-09-aceitar-termos-legais.md) | Bug funcional | Alta | Critério de "pendente" diverge entre `TermsInterceptor` (por versão) e as telas de aceite (qualquer versão aceita) — gera loop de redirecionamento ao reeditar um documento legal já aceito. | Aberto | Autenticação |
| UC-09-RN-03 | [UC-09](UC-09-aceitar-termos-legais.md) | Bug funcional | Alta | Divergência de filtro (`required_for_registration`/`required_for_existing_users`) entre `usePendingTerms` e as páginas de aceite — mesmo efeito de loop de redirecionamento do RN-02. | Aberto | Autenticação |
| UC-11-RN-07 | [UC-11](UC-11-inserir-nota-fiscal-manualmente.md) | Bug funcional | Alta | `nf_imports` criado com `status: "success"` fixo antes da gravação (não atômica) dos itens de inventário — falha parcial não é revertida nem refletida no status. | Aberto | Inventário |
| UC-13-RN-07 | [UC-13](UC-13-desativar-item-de-estoque-com-verificacao-de-reservas-ativas.md) | Bug funcional | Alta | Falha ao verificar reservas ativas é tratada como "sem reservas" — item pode ser desativado sem redistribuição mesmo tendo reservas reais não verificadas. | Aberto | Inventário |
| UC-14-Q1 | [UC-14](UC-14-auditar-e-corrigir-inconsistencias-de-inventario.md) | Achado de segurança | Alta | Ferramenta de correção em lote do inventário (potencialmente destrutiva) não tem nenhuma restrição de role — qualquer usuário do tenant pode executá-la. | Aberto | Inventário |
| UC-21-RN-03 | [UC-21](UC-21-cadastrar-nova-clinica.md) | Achado de segurança | Alta | Senha inicial do admin de clínica é escolhida manualmente pelo System Admin e enviada em texto plano por e-mail. | Aberto | Admin — Clínicas |
| UC-21-RN-05 | [UC-21](UC-21-cadastrar-nova-clinica.md) | Achado de segurança | Alta | Nenhum mecanismo técnico força a troca da senha inicial apesar do aviso na tela — `requirePasswordChange` nunca é setada por este fluxo. | Aberto | Admin — Clínicas |
| UC-22-RN-05 | [UC-22](UC-22-editar-desativar-e-reativar-clinica.md) | Achado de segurança | Alta | Mecanismo rico de suspensão de clínica (motivo, e-mail de contato, cascata de desativação de usuários) está implementado mas totalmente órfão — nunca acionável por nenhuma tela. | Aberto | Admin — Clínicas |
| UC-22-RN-06 | [UC-22](UC-22-editar-desativar-e-reativar-clinica.md) | Achado de segurança | Alta | Regra do Firestore permite que o próprio tenant (`clinic_admin`/`clinic_user`) edite os dados cadastrais da própria clínica diretamente, sem passar pelas telas administrativas. | Aberto | Admin — Clínicas |
| UC-28-RN-04 | [UC-28](UC-28-cadastrar-consultor.md) | Achado de segurança | Alta | Senha temporária do consultor recém-criado é enviada em texto plano por e-mail. | Aberto | Admin — Consultores |
| UC-32-RN-01 | [UC-32](UC-32-editar-ativar-e-desativar-produto-no-catalogo-master.md) | Bug funcional | Alta | Formulário de edição sempre reenvia `fragmentavel`, disparando incondicionalmente a checagem de "produto em uso" — bloqueia a edição inteira (mesmo campos não relacionados) sempre que o produto já está no inventário de alguma clínica. | Aberto | Admin — Catálogo de Produtos |
| UC-35-RN-04 | [UC-35](UC-35-editar-configuracoes-globais-do-sistema.md) | Divergência texto/UI vs lógica | Alta | `maintenance_mode`/`maintenance_message` não são lidos por nenhuma outra parte do sistema — ativar "Modo de Manutenção" não bloqueia nada. | Aberto | Admin — Configurações |
| UC-35-RN-05 | [UC-35](UC-35-editar-configuracoes-globais-do-sistema.md) | Divergência texto/UI vs lógica | Alta | `registration_enabled` não é lido por `/register` nem por `POST /api/access-requests` — desligar "Permitir novos registros" não bloqueia nenhum cadastro (cross-ref [UC-01-RN-10](UC-01-solicitar-acesso-ao-sistema.md)). | Aberto | Admin — Configurações |
| UC-35-RN-06 | [UC-35](UC-35-editar-configuracoes-globais-do-sistema.md) | Divergência texto/UI vs lógica | Alta | `session_timeout_minutes` não é lido por `useSessionTimeout.ts`, que usa um valor fixo de 15 minutos hardcoded (cross-ref [UC-04-Q3](UC-04-fazer-login-com-redirecionamento-por-papel.md)). | Aberto | Admin — Configurações |
| UC-39-RN-02 | [UC-39](UC-39-criar-usuario-diretamente-para-clinica-via-painel-admin.md) | Divergência texto/UI vs lógica | Alta | O texto do diálogo "Adicionar Novo Usuário" promete envio de credenciais por e-mail, mas isso nunca ocorre — o e-mail disparado é genérico e nunca inclui a senha. | Aberto | Admin — Usuários |
| UC-39-RN-03 | [UC-39](UC-39-criar-usuario-diretamente-para-clinica-via-painel-admin.md) | Achado de segurança | Alta | Usuário criado diretamente pelo System Admin nunca recebe a claim `requirePasswordChange` — nunca é obrigado a trocar a senha escolhida pelo admin. | Aberto | Admin — Usuários |
| UC-40-RN-04 | [UC-40](UC-40-criar-usuario-para-a-propria-clinica.md) | Achado de segurança | Alta | A regra `allow list` do Firestore para `users/{userId}` não filtra por `tenant_id` na própria regra — depende apenas de convenção no código-cliente para isolamento multi-tenant. | Aberto | Clínica — Usuários |
| UC-42-RN-02 | [UC-42](UC-42-executar-verificacoes-de-alertas-manualmente.md) | Bug funcional | Alta | `checkExpiredProducts` nunca persiste uma notificação real (trecho substituído por um placeholder) — reporta sucesso e conta produtos "criados" sem gravar nada. | Aberto | Notificações e Alertas |
| UC-44-RN-01 | [UC-44](UC-44-consultar-e-gerenciar-notificacoes-recebidas.md) | Bug funcional | Alta | O hook `useNotifications` expõe um estado de erro, mas `NotificationBell` nunca o lê — toda falha de ação (marcar como lida, excluir, limpar) é silenciosa para o usuário. | Aberto | Notificações e Alertas |
| UC-44-RN-02 | [UC-44](UC-44-consultar-e-gerenciar-notificacoes-recebidas.md) | Achado de segurança | Alta | Regra do Firestore restringe exclusão de notificação a `clinic_admin`, mas a UI mostra os botões de exclusão identicamente para `clinic_user` — falha de permissão silenciosa e sem explicação. | Aberto | Notificações e Alertas |
| UC-46-RN-03 | [UC-46](UC-46-visualizar-consultor-vinculado-a-clinica.md) | Bug funcional | Alta | `/clinic/consultant/transfer` (vincular consultor por código, pelo lado da clínica) está completamente quebrada — a API sempre rejeita qualquer usuário de clínica com 403. | Aberto | Gestão de Clínica / Consultores |

---

## 3. Itens de Média e Baixa Severidade

Agrupados por módulo/portal.

### Autenticação / Acesso

| ID | UC de Origem | Categoria | Severidade | Resumo | Status |
|---|---|---|---|---|---|
| UC-07-RN-03 | [UC-07](UC-07-recuperar-senha-esquecida.md) | Achado de segurança | Média | Mensagem "Usuário não encontrado" ao recuperar senha permite enumeração de contas cadastradas. | Aberto |
| UC-06-Q1 | [UC-06](UC-06-trocar-senha-obrigatoria-no-primeiro-acesso.md) | Bug funcional | Média | Falha silenciosa ao limpar `requirePasswordChange` pode gerar impasse: usuário preso trocando uma senha que já é a definitiva. | Aberto |
| UC-09-Fluxo8d | [UC-09](UC-09-aceitar-termos-legais.md) | Bug funcional | Média | Variante B (onboarding) de aceite de termos não redireciona usuário deslogado — tela fica carregando indefinidamente. | Aberto |
| UC-01-RN-09 | [UC-01](UC-01-solicitar-acesso-ao-sistema.md) | Débito técnico | Baixa | Sem checagem de duplicidade de solicitação pendente para o mesmo e-mail em `POST /api/access-requests`. | Aberto |
| UC-01-RN-04-05-06 | [UC-01](UC-01-solicitar-acesso-ao-sistema.md) | Débito técnico | Baixa | Validação de frontend mais permissiva que a de backend (nome, e-mail, telefone) — gera erro de submissão só percebido no servidor. | Aberto |
| UC-03-Q1 | [UC-03](UC-03-rejeitar-solicitacao-de-acesso.md) | Achado de UX | Baixa | Placeholder do campo "Motivo da rejeição" cita CPF/CNPJ, schema desatualizado desde UC-01 v2.0 (cosmético). | Aberto |
| UC-04-Q1 | [UC-04](UC-04-fazer-login-com-redirecionamento-por-papel.md) | Débito técnico | Baixa | Redirecionamento de `clinic_consultant` no login faz um salto duplo (`/dashboard` → `/consultant/dashboard`), inconsistente com a lógica já correta de `ProtectedRoute`. | Aberto |
| UC-04-Q2 | [UC-04](UC-04-fazer-login-com-redirecionamento-por-papel.md) | Achado de UX | Baixa | Tela `/waiting-approval` reutilizada tanto para "aguardando aprovação" quanto para "conta desativada", com a mesma mensagem em ambos os casos. | Aberto |
| UC-06-RN-02 | [UC-06](UC-06-trocar-senha-obrigatoria-no-primeiro-acesso.md) | Débito técnico | Baixa | Validação de força de senha nesta tela é mais fraca (só comprimento) que a `validatePassword` compartilhada. | Aberto |
| UC-07-RN-04 | [UC-07](UC-07-recuperar-senha-esquecida.md) | Achado de UX | Baixa | `/forgot-password` não verifica se o usuário já está autenticado, diferente de `/login`/`/register`. | Aberto |
| UC-08-RNF-02 | [UC-08](UC-08-system-admin-envia-link-de-redefinicao-de-senha.md) | Achado de UX | Baixa | Diálogo de confirmação do admin usa `confirm()` nativo em vez do padrão `Dialog` do sistema. | Aberto |
| UC-08-RNF-03 | [UC-08](UC-08-system-admin-envia-link-de-redefinicao-de-senha.md) | Débito técnico | Baixa | Apenas a solicitação de redefinição mais recente é registrada — sem histórico completo de reenvios. | Aberto |
| UC-09-RN-07 | [UC-09](UC-09-aceitar-termos-legais.md) | Débito técnico | Baixa | `ip_address` nunca é de fato capturado nos registros de aceite, apesar de existir no schema. | Aberto |
| UC-09-RNF-03 | [UC-09](UC-09-aceitar-termos-legais.md) | Achado de UX | Baixa | Mensagens de erro do Firestore exibidas cruas ao usuário, sem tradução. | Aberto |

### Inventário

| ID | UC de Origem | Categoria | Severidade | Resumo | Status |
|---|---|---|---|---|---|
| UC-11-Q1 | [UC-11](UC-11-inserir-nota-fiscal-manualmente.md) | Achado de segurança | Média | Ator real da tela de inserção manual inclui `clinic_user` (não só `clinic_admin` como esperado) — sem checagem de role própria, diferente de UC-10. | Aberto |
| UC-11-RN-09-10-11 | [UC-11](UC-11-inserir-nota-fiscal-manualmente.md) | Débito técnico | Média | Divergências de schema entre itens de inventário criados via XML (UC-10) e manual (UC-11): `created_by` (uid vs. e-mail), `dt_validade` (Timestamp vs. string), `nf_id` vs. `nf_import_id`. | Aberto |
| UC-12-RN-02 | [UC-12](UC-12-resolver-produtos-pendentes-de-cadastro.md) | Bug funcional | Média | "Marcar Resolvido" não valida se o produto foi de fato cadastrado no catálogo master — é limpeza de fila, não uma validação. | Aberto |
| UC-13-RN-09 | [UC-13](UC-13-desativar-item-de-estoque-com-verificacao-de-reservas-ativas.md) | Achado de segurança | Média | Restrição "só `clinic_admin` desativa item" é aplicada só na UI, sem regra dedicada no Firestore. | Aberto |
| UC-14-RN-04 | [UC-14](UC-14-auditar-e-corrigir-inconsistencias-de-inventario.md) | Débito técnico | Média | Definição de "reserva ativa" diverge entre esta auditoria (`agendada`+`aprovada`) e UC-13 (só `agendada`). | Aberto |
| UC-15-RN-05 | [UC-15](UC-15-configurar-limite-de-estoque-baixo-por-produto.md) | Débito técnico | Média | Nenhum agendamento automático roda as verificações de alerta de estoque baixo — depende inteiramente de acionamento manual (UC-42). | Aberto |
| UC-15-RN-07 | [UC-15](UC-15-configurar-limite-de-estoque-baixo-por-produto.md) | Achado de segurança | Média | Sem regra dedicada no Firestore para `stock_limits` — restrição de role é só na UI. | Aberto |
| UC-15-RN-08 | [UC-15](UC-15-configurar-limite-de-estoque-baixo-por-produto.md) | Bug funcional | Média | `checkLowStock` não filtra `active: true`, somando quantidade residual de lotes já desativados (UC-13). | Aberto |
| UC-13-RN-04 | [UC-13](UC-13-desativar-item-de-estoque-com-verificacao-de-reservas-ativas.md) | Débito técnico | Baixa | Ordem de alocação entre solicitações concorrentes na redistribuição forçada não segue a data do procedimento. | Aberto |
| UC-13-RN-08 | [UC-13](UC-13-desativar-item-de-estoque-com-verificacao-de-reservas-ativas.md) | Achado de UX | Baixa | Nenhuma notificação aos responsáveis por procedimentos alterados/cancelados automaticamente pela redistribuição forçada. | Aberto |
| UC-11-RN-06 | [UC-11](UC-11-inserir-nota-fiscal-manualmente.md) | Achado de UX | Baixa | Checagem de duplicidade de NF só ocorre no último passo do wizard, diferente de UC-10 (checa antes do upload). | Aberto |
| UC-12-RN-01 | [UC-12](UC-12-resolver-produtos-pendentes-de-cadastro.md) | Achado de UX | Baixa | Botão "Cadastrar Produto" (fila de pendências) não leva nenhum prefill de código/nome para a tela de cadastro. | Aberto |
| UC-12-RN-03 | [UC-12](UC-12-resolver-produtos-pendentes-de-cadastro.md) | Débito técnico | Baixa | Pendência removida sem resolução real gera pendência nova (não reaproveitada) no próximo reenvio de XML, sem histórico. | Aberto |
| UC-14-RN-03 | [UC-14](UC-14-auditar-e-corrigir-inconsistencias-de-inventario.md) | Débito técnico | Baixa | `Math.max(0, ...)` pode mascarar inconsistências mais graves (valores que deveriam ser negativos). | Aberto |
| UC-15-RN-03 | [UC-15](UC-15-configurar-limite-de-estoque-baixo-por-produto.md) | Divergência texto/UI vs lógica | Baixa | UI usa fallback simples (10) enquanto a notificação automática usa fallback em 3 níveis — podem divergir visivelmente. | Aberto |
| UC-15-RN-06 | [UC-15](UC-15-configurar-limite-de-estoque-baixo-por-produto.md) | Achado de UX | Baixa | Validação inválida e falha de gravação do limite de estoque são silenciosas, sem feedback ao usuário. | Aberto |

### Procedimentos

| ID | UC de Origem | Categoria | Severidade | Resumo | Status |
|---|---|---|---|---|---|
| UC-16-RN-08 | [UC-16](UC-16-registrar-procedimento-programado.md) | Bug funcional | Média | Aplicar um protocolo substitui a lista de produtos já selecionados sem aviso, descartando produtos adicionados manualmente antes. | Aberto |
| UC-16-RN-09 | [UC-16](UC-16-registrar-procedimento-programado.md) | Bug funcional | Média | Aplicação de protocolo não valida nem avisa sobre estoque insuficiente, diferente da adição manual de produtos. | Aberto |
| UC-18-RN-04 | [UC-18](UC-18-editar-procedimento-agendado.md) | Débito técnico | Média | Editar produtos de uma solicitação agendada não grava em `status_history` nem `inventory_activity` — gap de auditoria. | Aberto |
| UC-20-RN-07 | [UC-20](UC-20-gerenciar-protocolos.md) | Achado de segurança | Média | Sem regra dedicada no Firestore para `protocolos` — restrição de role (`clinic_admin`) é só na UI. | Aberto |
| UC-16-RN-02 | [UC-16](UC-16-registrar-procedimento-programado.md) | Débito técnico | Baixa | Alocação FEFO duplicada — implementações independentes em UC-13 e UC-16, sem código compartilhado. | Aberto |
| UC-17-RN-05 | [UC-17](UC-17-registrar-procedimento-efetuado.md) | Achado de UX | Baixa | Aplicação de protocolo bypassa a exigência de seleção manual de lote deste modo, misturando critérios no mesmo procedimento. | Aberto |
| UC-18-RN-02 | [UC-18](UC-18-editar-procedimento-agendado.md) | Débito técnico | Baixa | Algoritmo de ajuste de reservas na edição é "liberar tudo e recriar tudo", não incremental — confuso para auditoria manual dos dados brutos. | Aberto |
| UC-18-RNF-02 | [UC-18](UC-18-editar-procedimento-agendado.md) | Débito técnico | Baixa | Dados de edição de procedimento trafegam via query string — risco teórico de limite de tamanho de URL. | Aberto |
| UC-19-RN-06 | [UC-19](UC-19-concluir-ou-cancelar-procedimento-agendado.md) | Achado de UX | Baixa | Nenhuma confirmação antes de concluir/cancelar um procedimento (ação irreversível), diferente do padrão de UC-13. | Aberto |
| UC-20-RN-05 | [UC-20](UC-20-gerenciar-protocolos.md) | Achado de UX | Baixa | Protocolos podem incluir produtos sem estoque disponível, causando omissão silenciosa ao aplicar (mesmo gap de UC-16). | Aberto |
| UC-20-RN-06 | [UC-20](UC-20-gerenciar-protocolos.md) | Débito técnico | Baixa | Sem validação de nome duplicado entre protocolos do mesmo tenant. | Aberto |

### Administração do Sistema — Clínicas / Consultores

| ID | UC de Origem | Categoria | Severidade | Resumo | Status |
|---|---|---|---|---|---|
| UC-23-RN-03 | [UC-23](UC-23-vincular-alterar-remover-consultor-da-clinica.md) | Débito técnico | Média | Sincronização de custom claims do consultor ocorre fora da transação atômica do Firestore — risco de inconsistência em falha parcial. | Aberto |
| UC-24-RN-02 | [UC-24](UC-24-vincular-se-automaticamente-a-clinica-sem-consultor.md) | Bug funcional | Média | Falha ao sincronizar custom claims do consultor é absorvida silenciosamente — usuário vê "sucesso" mesmo com claims não sincronizadas. | Aberto |
| UC-26-RN-03 | [UC-26](UC-26-aprovar-pedido-de-transferencia-de-clinica.md) | Bug funcional | Média | Sincronização de claims sem `try/catch` pode retornar erro 500 ao usuário mesmo com os dados já alterados no Firestore. | Aberto |
| UC-28-RN-05 | [UC-28](UC-28-cadastrar-consultor.md) | Débito técnico | Média | Sem rollback se a falha ocorrer após a criação do usuário no Firebase Auth — pode deixar usuário órfão. | Aberto |
| UC-29-RN-03 | [UC-29](UC-29-editar-suspender-e-reativar-consultor.md) | Achado de UX | Média | Editar o e-mail de login de um consultor não notifica ninguém — pode travar o acesso dele sem explicação. | Aberto |
| UC-21-RN-07 | [UC-21](UC-21-cadastrar-nova-clinica.md) | Achado de UX | Baixa | Impossível retroceder no wizard de cadastro de clínica sem cancelar o processo inteiro. | Aberto |
| UC-21-RN-09 | [UC-21](UC-21-cadastrar-nova-clinica.md) | Débito técnico | Baixa | E-mail de notificação interna de novo tenant é hardcoded; campo `plan_id` nunca é definido. | Aberto |
| UC-22-RN-07 | [UC-22](UC-22-editar-desativar-e-reativar-clinica.md) | Achado de UX | Baixa | Atalho de "Desativar" existe na listagem de clínicas, mas não há atalho equivalente de "Reativar". | Aberto |
| UC-22-RN-08 | [UC-22](UC-22-editar-desativar-e-reativar-clinica.md) | Achado de UX | Baixa | Feedback de sucesso/erro inconsistente entre as duas telas de desativação de clínica (mensagem inline vs. `alert()`). | Aberto |
| UC-22-RNF-01 | [UC-22](UC-22-editar-desativar-e-reativar-clinica.md) | Débito técnico | Baixa | Nenhum motivo ou auditoria registrado ao desativar/reativar uma clínica pelo mecanismo simples. | Aberto |
| UC-24-RN-06 | [UC-24](UC-24-vincular-se-automaticamente-a-clinica-sem-consultor.md) | Achado de segurança | Baixa | Regra do Firestore permite que um `clinic_admin` escreva diretamente em `consultant_claims` (risco teórico, hoje inatingível). | Aberto |
| UC-25-RN-02 | [UC-25](UC-25-solicitar-transferencia-de-clinica-ja-vinculada.md) | Débito técnico | Baixa | Nenhum prazo de expiração para um pedido de transferência de clínica pendente. | Aberto |
| UC-25-RN-03 | [UC-25](UC-25-solicitar-transferencia-de-clinica-ja-vinculada.md) | Achado de UX | Baixa | Notificação ao consultor atual sobre um pedido de transferência é só por e-mail, sem notificação in-app nem link direto ao pedido. | Aberto |
| UC-26-RN-01 | [UC-26](UC-26-aprovar-pedido-de-transferencia-de-clinica.md) | Achado de UX | Baixa | Nenhuma confirmação antes de aprovar um pedido de transferência de clínica (ação irreversível, único clique). | Aberto |
| UC-27-RN-03 | [UC-27](UC-27-rejeitar-pedido-de-transferencia-de-clinica.md) | Achado de UX | Baixa | Assimetria de confirmação: aprovar transferência (mais impactante) não pede confirmação, rejeitar pede. | Aberto |
| UC-28-RN-02 | [UC-28](UC-28-cadastrar-consultor.md) | Débito técnico | Baixa | Janela de corrida teórica na geração do código único de 6 dígitos do consultor (checagem e escrita não atômicas). | Aberto |
| UC-29-RN-05 | [UC-29](UC-29-editar-suspender-e-reativar-consultor.md) | Débito técnico | Baixa | Formulário de edição do consultor sempre reenvia o e-mail, disparando chamada desnecessária ao Firebase Auth a cada salvamento. | Aberto |
| UC-30-RN-03 | [UC-30](UC-30-definir-senha-consultor-manualmente.md) | Achado de UX | Baixa | UI ignora a mensagem de sucesso diferenciada retornada pela API ao definir senha do consultor. | Aberto |
| UC-30-RN-06 | [UC-30](UC-30-definir-senha-consultor-manualmente.md) | Achado de segurança | Baixa | `error.message` bruto do Firebase Admin SDK exposto em respostas de erro 500. | Aberto |
| UC-30-RN-07 | [UC-30](UC-30-definir-senha-consultor-manualmente.md) | Débito técnico | Baixa | Campos de auditoria gravados (`passwordSetByAdminAt` etc.) não estão declarados na interface `Consultant`. | Aberto |
| UC-30-RN-08 | [UC-30](UC-30-definir-senha-consultor-manualmente.md) | Débito técnico | Baixa | Sem histórico auditável de definições manuais de senha de consultor — apenas a mais recente é registrada. | Aberto |

### Administração do Sistema — Catálogo / Documentos Legais / Configurações

| ID | UC de Origem | Categoria | Severidade | Resumo | Status |
|---|---|---|---|---|---|
| UC-31-RN-02 | [UC-31](UC-31-cadastrar-produto-no-catalogo-master.md) | Débito técnico | Média | Nenhuma validação server-side de formato no cadastro de produto master — só client SDK + regra do Firestore. | Aberto |
| UC-32-RN-02 | [UC-32](UC-32-editar-ativar-e-desativar-produto-no-catalogo-master.md) | Bug funcional | Média | Ativar/Desativar produto direto na listagem não tem confirmação nem checa se o produto está em uso. | Aberto |
| UC-32-RN-03 | [UC-32](UC-32-editar-ativar-e-desativar-produto-no-catalogo-master.md) | Bug funcional | Média | Flag `active` de produto tem efeito inconsistente entre UC-10 (ignorado) e UC-11 (filtrado) — desativar não bloqueia os dois caminhos de entrada de estoque. | Aberto |
| UC-33-RN-03 | [UC-33](UC-33-cadastrar-documento-legal.md) | Débito técnico | Média | Nenhuma validação server-side de formato no cadastro de documento legal. | Aberto |
| UC-33-RN-04 | [UC-33](UC-33-cadastrar-documento-legal.md) | Achado de segurança | Média | Regra do Firestore permite leitura de documentos legais em qualquer status (inclusive "rascunho") a qualquer usuário autenticado. | Aberto |
| UC-34-RN-05 | [UC-34](UC-34-editar-publicar-e-excluir-documento-legal.md) | Bug funcional | Média | Nenhum aviso ao editar versão/obrigatoriedade de documento já ativo e potencialmente já aceito — pode disparar o loop de redirecionamento do UC-09. | Aberto |
| UC-31-RN-01 | [UC-31](UC-31-cadastrar-produto-no-catalogo-master.md) | Débito técnico | Baixa | Checagem de duplicidade de código de produto master não é atômica (janela de corrida teórica). | Aberto |
| UC-32-RN-06 | [UC-32](UC-32-editar-ativar-e-desativar-produto-no-catalogo-master.md) | Achado de UX | Baixa | Sem opção de limpar a categoria de um produto já categorizado, via UI. | Aberto |
| UC-33-RN-01 | [UC-33](UC-33-cadastrar-documento-legal.md) | Débito técnico | Baixa | Sem verificação de duplicidade de `slug` entre documentos legais. | Aberto |
| UC-33-RN-02 | [UC-33](UC-33-cadastrar-documento-legal.md) | Débito técnico | Baixa | Sem verificação de duplicidade de "Ordem de Exibição" entre documentos legais. | Aberto |
| UC-34-RN-01 | [UC-34](UC-34-editar-publicar-e-excluir-documento-legal.md) | Achado de UX | Baixa | Slug sempre recalculado ao editar o título, sobrescrevendo qualquer customização manual anterior. | Aberto |
| UC-34-RN-02 | [UC-34](UC-34-editar-publicar-e-excluir-documento-legal.md) | Débito técnico | Baixa | `published_at` é sobrescrito a cada salvamento com status ativo e nunca é lido por nenhuma tela do sistema. | Aberto |
| UC-35-RN-01 | [UC-35](UC-35-editar-configuracoes-globais-do-sistema.md) | Débito técnico | Baixa | Documento de configurações globais é sobrescrito por inteiro (`setDoc` sem `merge`), sem detecção de conflito concorrente. | Aberto |
| UC-35-RN-07 | [UC-35](UC-35-editar-configuracoes-globais-do-sistema.md) | Achado de segurança | Baixa | Regra do Firestore permite leitura de `system_settings/global` a qualquer usuário autenticado, não só `system_admin`. | Aberto |

### Administração do Sistema — Usuários / Autoatendimento

| ID | UC de Origem | Categoria | Severidade | Resumo | Status |
|---|---|---|---|---|---|
| UC-36-RN-07 | [UC-36](UC-36-editar-usuario-e-alterar-status-cross-tenant.md) | Débito técnico | Média | Nenhuma validação impede que uma clínica fique sem nenhum `clinic_admin` ativo após uma edição de função/status. | Aberto |
| UC-39-RN-05 | [UC-39](UC-39-criar-usuario-diretamente-para-clinica-via-painel-admin.md) | Bug funcional | Média | API de criação de usuário não verifica se o tenant está ativo antes de permitir a criação. | Aberto |
| UC-36-RN-09 | [UC-36](UC-36-editar-usuario-e-alterar-status-cross-tenant.md) | Achado de UX | Baixa | Sem confirmação dedicada para mudança de status de usuário (diferente do padrão de UC-22/UC-29). | Aberto |
| UC-36-RNF-02 | [UC-36](UC-36-editar-usuario-e-alterar-status-cross-tenant.md) | Débito técnico | Baixa | Nenhuma auditoria de quem editou o quê em um usuário (só `updated_at` é gravado). | Aberto |
| UC-37-RN-03 | [UC-37](UC-37-definir-senha-usuario-manualmente.md) | Achado de UX | Baixa | UI ignora a mensagem de sucesso diferenciada retornada pela API ao definir senha de usuário. | Aberto |
| UC-37-RN-06 | [UC-37](UC-37-definir-senha-usuario-manualmente.md) | Achado de segurança | Baixa | `error.message` bruto do SDK exposto em erros 500 (mesmo padrão de UC-30). | Aberto |
| UC-37-RN-07 | [UC-37](UC-37-definir-senha-usuario-manualmente.md) | Achado de UX | Baixa | Checkbox "Solicitar troca de senha" vem desmarcada por padrão aqui, mas marcada por padrão no equivalente de consultores (UC-30) — divergência não explicada. | Aberto |
| UC-37-RN-08 | [UC-37](UC-37-definir-senha-usuario-manualmente.md) | Débito técnico | Baixa | Campos de auditoria gravados não estão declarados na interface `User`. | Aberto |
| UC-37-RN-09 | [UC-37](UC-37-definir-senha-usuario-manualmente.md) | Débito técnico | Baixa | Sem histórico auditável de definições manuais de senha de usuário — apenas a mais recente é registrada. | Aberto |
| UC-38-RN-01 | [UC-38](UC-38-editar-perfil-e-trocar-senha-do-system-admin.md) | Débito técnico | Baixa | Senha mínima de 8 caracteres para `system_admin` diverge do padrão de 6 usado no resto do sistema. | Aberto |
| UC-38-RN-03 | [UC-38](UC-38-editar-perfil-e-trocar-senha-do-system-admin.md) | Achado de UX | Baixa | Sem bloqueio para nova senha igual à senha atual (diferente de UC-06). | Aberto |
| UC-38-RN-04 | [UC-38](UC-38-editar-perfil-e-trocar-senha-do-system-admin.md) | Débito técnico | Baixa | Tratamento de erro de reautenticação incompleto — não trata `auth/invalid-credential`, só `auth/wrong-password`. | Aberto |
| UC-38-RN-07 | [UC-38](UC-38-editar-perfil-e-trocar-senha-do-system-admin.md) | Débito técnico | Baixa | Nenhuma auditoria registrada quando o próprio `system_admin` troca a senha. | Aberto |
| UC-39-RN-01 | [UC-39](UC-39-criar-usuario-diretamente-para-clinica-via-painel-admin.md) | Débito técnico | Baixa | Nenhuma validação client-side no diálogo de criação de usuário do Portal Admin. | Aberto |
| UC-39-RN-08 | [UC-39](UC-39-criar-usuario-diretamente-para-clinica-via-painel-admin.md) | Débito técnico | Baixa | Nenhum campo de auditoria distingue se um usuário foi criado via System Admin ou via aprovação de solicitação. | Aberto |

### Clínica — Usuários / Autoatendimento

| ID | UC de Origem | Categoria | Severidade | Resumo | Status |
|---|---|---|---|---|---|
| UC-40-RN-02 | [UC-40](UC-40-criar-usuario-para-a-propria-clinica.md) | Achado de segurança | Baixa | Variável `isAdmin` declarada mas nunca usada para gating em `UsersTab` — pode piscar conteúdo de admin para `clinic_user` na página órfã. | Aberto |
| UC-40-RN-07 | [UC-40](UC-40-criar-usuario-para-a-propria-clinica.md) | Achado de segurança | Baixa | Nenhuma restrição para um `clinic_admin` criar outro `clinic_admin` para a própria clínica. | Aberto |
| UC-41-RN-03 | [UC-41](UC-41-editar-perfil-e-trocar-senha-do-usuario-de-clinica.md) | Achado de UX | Baixa | Sem bloqueio para nova senha igual à atual (mesmo achado de UC-38). | Aberto |
| UC-41-RN-04 | [UC-41](UC-41-editar-perfil-e-trocar-senha-do-usuario-de-clinica.md) | Débito técnico | Baixa | Tratamento de erro de reautenticação incompleto (mesmo achado de UC-38). | Aberto |
| UC-41-RN-07 | [UC-41](UC-41-editar-perfil-e-trocar-senha-do-usuario-de-clinica.md) | Débito técnico | Baixa | Nenhuma auditoria registrada quando o usuário de clínica troca a própria senha. | Aberto |
| UC-41-RNF-04 | [UC-41](UC-41-editar-perfil-e-trocar-senha-do-usuario-de-clinica.md) | Achado de UX | Baixa | Falha ao carregar o histórico de aceites de termos é silenciosa (só `console.error`). | Aberto |

### Onboarding de Clínica

| ID | UC de Origem | Categoria | Severidade | Resumo | Status |
|---|---|---|---|---|---|
| UC-45-RN-02 | [UC-45](UC-45-completar-configuracao-inicial-da-clinica.md) | Achado de segurança | Média | Sem distinção de role entre `clinic_admin`/`clinic_user` para editar os dados cadastrais da clínica em `/clinic/setup`. | Aberto |
| UC-45-RN-04 | [UC-45](UC-45-completar-configuracao-inicial-da-clinica.md) | Achado de UX | Média | Sem flag de "onboarding concluído" — `/clinic/setup` permanece acessível indefinidamente como uma segunda via de edição de dados cadastrais. | Aberto |
| UC-45-RN-05 | [UC-45](UC-45-completar-configuracao-inicial-da-clinica.md) | Débito técnico | Baixa | Campo legado `cnpj` nunca é atualizado por este fluxo, pode divergir de `document_number`. | Aberto |
| UC-45-RN-06 | [UC-45](UC-45-completar-configuracao-inicial-da-clinica.md) | Débito técnico | Baixa | Validação de CPF só verifica quantidade de dígitos, sem checagem de dígito verificador (assimétrico com CNPJ). | Aberto |

### Notificações e Alertas

| ID | UC de Origem | Categoria | Severidade | Resumo | Status |
|---|---|---|---|---|---|
| UC-42-RN-03 | [UC-42](UC-42-executar-verificacoes-de-alertas-manualmente.md) | Bug funcional | Média | Nenhuma das três funções de verificação de alerta filtra `active: true` no inventário. | Aberto |
| UC-42-RN-05 | [UC-42](UC-42-executar-verificacoes-de-alertas-manualmente.md) | Débito técnico | Média | Nenhum agendamento automático roda as verificações de alerta — depende inteiramente de acionamento manual (cross-ref UC-15). | Aberto |
| UC-42-RN-07 | [UC-42](UC-42-executar-verificacoes-de-alertas-manualmente.md) | Achado de UX | Baixa | Deduplicação de alertas reseta ao marcar como lida — gera notificação duplicada mesmo sem mudança na condição de origem. | Aberto |
| UC-43-RN-05 | [UC-43](UC-43-configurar-preferencias-de-notificacao.md) | Débito técnico | Baixa | `email_notifications` é persistido mas não tem nenhum consumidor funcional (UI sempre desabilitada, "em breve"). | Aberto |
| UC-44-RN-04 | [UC-44](UC-44-consultar-e-gerenciar-notificacoes-recebidas.md) | Divergência texto/UI vs lógica | Baixa | `notification_sound` (configurado em UC-43) não controla o som real tocado pelo `NotificationBell` (fixo `true`). | Aberto |
| UC-44-RN-05 | [UC-44](UC-44-consultar-e-gerenciar-notificacoes-recebidas.md) | Débito técnico | Baixa | Limite fixo de 50 notificações exibidas, sem paginação. | Aberto |
| UC-44-RN-07 | [UC-44](UC-44-consultar-e-gerenciar-notificacoes-recebidas.md) | Achado de UX | Baixa | Exclusão de notificação individual não pede confirmação, diferente da limpeza em lote. | Aberto |

### Gestão de Clínica / Consultores (Consulta)

| ID | UC de Origem | Categoria | Severidade | Resumo | Status |
|---|---|---|---|---|---|
| UC-46-RN-04 | [UC-46](UC-46-visualizar-consultor-vinculado-a-clinica.md) | Achado de segurança | Média | Gate de role invertido em `/clinic/consultant/transfer`: bloqueia `clinic_admin`, mas permite `clinic_user` acessar o formulário quebrado. | Aberto |
| UC-46-RN-01 | [UC-46](UC-46-visualizar-consultor-vinculado-a-clinica.md) | Débito técnico | Baixa | Duplicação de código entre `ClinicConsultantPage` e `ConsultantTab` — mesma consulta, implementações independentes. | Aberto |
| UC-46-RN-02 | [UC-46](UC-46-visualizar-consultor-vinculado-a-clinica.md) | Achado de UX | Baixa | Falhas ao buscar o consultor vinculado são indistinguíveis do estado "sem consultor" — sem mensagem de erro. | Aberto |

### Relatórios

| ID | UC de Origem | Categoria | Severidade | Resumo | Status |
|---|---|---|---|---|---|
| UC-47-RN-02 | [UC-47](UC-47-gerar-relatorios-de-estoque-vencimento-e-consumo.md) | Bug funcional | Média | Itens de inventário com data de validade em formato não reconhecido são silenciosamente excluídos do Relatório de Vencimento, subestimando o "Valor em Risco". | Aberto |
| UC-47-RN-01 | [UC-47](UC-47-gerar-relatorios-de-estoque-vencimento-e-consumo.md) | Achado de UX | Baixa | Relatório "Produtos Vencendo" também inclui produtos já vencidos — nome pode confundir o usuário. | Aberto |
| UC-47-RNF-01 | [UC-47](UC-47-gerar-relatorios-de-estoque-vencimento-e-consumo.md) | Achado de UX | Baixa | Feedback de erro via `alert()` nativo, inconsistente com o padrão de toast do resto do sistema. | Aberto |

### Portal do Consultor

| ID | UC de Origem | Categoria | Severidade | Resumo | Status |
|---|---|---|---|---|---|
| UC-48-RN-02 | [UC-48](UC-48-consultar-clinicas-vinculadas-e-estoque.md) | Divergência texto/UI vs lógica | Média | Card "Estoque Baixo" no detalhe da clínica diz "5 unidades ou menos", mas o cálculo real usa limiar `<= 10`. | Aberto |
| UC-48-RN-03 | [UC-48](UC-48-consultar-clinicas-vinculadas-e-estoque.md) | Débito técnico | Baixa | Terceiro mecanismo de limiar de "estoque baixo" (hardcoded, 10), totalmente desconectado de UC-15/UC-43. | Aberto |
| UC-49-RN-03 | [UC-49](UC-49-visualizar-perfil-proprio-do-consultor.md) | Achado de UX | Baixa | Falha ao carregar o perfil do consultor é silenciosa, sem estado de erro visível. | Aberto |

---

## 4. Decisões de Produto Pendentes

Itens que não são bugs — são escolhas de escopo/comportamento a serem decididas antes de virarem tarefa de correção.

| ID | UC de Origem | Categoria | Resumo | Opções Levantadas | Módulo |
|---|---|---|---|---|---|
| UC-02-Q1 | [UC-02](UC-02-aprovar-solicitacao-de-acesso.md) | Decisão de produto pendente | `document_type`/`document_number`/`address` do tenant são fallback fixo de código desde a mudança de formulário de UC-01, sem fonte real de dado. | (a) manter fallback fixo; (b) adicionar formulário na tela de aprovação; (c) remover os campos do modelo `Tenant`; (d) reintroduzir a coleta em UC-01. | Admin — Acesso |
| UC-05-Decisão | [UC-05](UC-05-vincular-se-automaticamente-a-clinica-sem-consultor.md) | Decisão de produto pendente | Botão "Aprovar Solicitação" pela própria clínica (`clinic_admin`) nunca funcionou — 3 problemas confirmados em cadeia (função depreciada, contagem de vagas errada, nenhuma solicitação real chega a existir). | (a) remover a tela/botão de aprovação do `clinic_admin`, mantendo só a rejeição; (b) implementar de fato o mecanismo, se houver motivo de negócio não explicado. | Admin da Clínica |
| UC-10-RN-02 | [UC-10](UC-10-importar-nfe-via-upload-de-xml.md) | Decisão de produto pendente | Regras de bloqueio por duplicidade de NF-e (v1) foram explicitamente sinalizadas pelo próprio usuário como sujeitas a revisão. | Revisão de negócio a definir; não deve ser tratada como regra definitiva. | Inventário |
| UC-22-Decisão | [UC-22](UC-22-editar-desativar-e-reativar-clinica.md) | Decisão de produto pendente | Mecanismo rico de suspensão de clínica (motivo, e-mail, cascata) está implementado, mas nunca é acionado por nenhuma tela. | (a) conectar os diálogos ricos às telas existentes, tornando o mecanismo simples obsoleto; (b) remover o mecanismo rico inteiro (dialogs, API, hook, telas `/suspended/*`). | Admin — Clínicas |
| UC-25-Decisão | [UC-25](UC-25-solicitar-transferencia-de-clinica-ja-vinculada.md) | Decisão de produto pendente | O backend de "Solicitar Transferência de Clínica" (ramo "CASO 2" da API) está pronto, mas nenhuma tela expõe um botão que o dispare — afeta também UC-26 e UC-27, que ficam sempre com a fila vazia. | (a) implementar o botão/fluxo de UI faltante; (b) remover o ramo da API e as rotas de aprovação/rejeição associadas, hoje inatingíveis. | Portal do Consultor |
| UC-29-Decisão | [UC-29](UC-29-editar-suspender-e-reativar-consultor.md) | Decisão de produto pendente | "Suspender" consultor (RN-01, listada como Crítica na Seção 2) não bloqueia login nem acesso; existe uma rota `DELETE` que implementaria a suspensão real, mas está órfã. | (a) trocar o botão "Suspender" para usar a rota `DELETE` já existente; (b) reforçar o handler `PUT` para também desabilitar a conta Auth e zerar os claims. | Admin — Consultores |
| UC-35-Decisão | [UC-35](UC-35-editar-configuracoes-globais-do-sistema.md) | Decisão de produto pendente | As três configurações da tela "Configurações do Sistema" (manutenção, registro, timeout — RN-04/05/06, listadas como Alta na Seção 2) não têm efeito real hoje. | (a) implementar os três consumidores reais; (b) remover/ocultar a tela até a decisão de implementar ser tomada. | Admin — Configurações |
| UC-36-Decisão | [UC-36](UC-36-editar-usuario-e-alterar-status-cross-tenant.md) | Decisão de produto pendente | Editar "Função"/"Status" de um usuário (RN-02/RN-03, listadas como Crítica na Seção 2) não tem efeito real de acesso — puramente cosmético no Firestore. | (a) implementar uma rota `PUT /api/users/[id]` dedicada que também sincronize custom claims (e desabilite a conta Auth para status "Inativo"); (b) deixar explícito na UI que a alteração é só de cadastro, sem efeito de acesso. | Admin — Usuários |
| UC-39-Decisão | [UC-39](UC-39-criar-usuario-diretamente-para-clinica-via-painel-admin.md) | Decisão de produto pendente | Texto da UI promete envio de credenciais por e-mail (RN-02, listada como Alta na Seção 2), que nunca ocorre — mesmo problema compartilhado com UC-40 (mesma rota de backend). | (a) corrigir o texto da UI para deixar claro que a senha não é enviada automaticamente; (b) implementar de fato o envio de credenciais, avaliando o risco de segurança de senha em texto plano por e-mail. | Admin — Usuários / Clínica — Usuários |
| UC-40-RN-08 | [UC-40](UC-40-criar-usuario-para-a-propria-clinica.md) | Decisão de produto pendente | `clinic_admin` não tem, hoje, nenhuma forma de editar, desativar/reativar ou redefinir/definir senha de um usuário já existente da própria clínica — apenas criar e listar. | (a) implementar uma tela análoga a UC-36/UC-37, escopada ao próprio tenant do `clinic_admin`; (b) manter como decisão consciente (contato com suporte/System Admin para qualquer correção). | Clínica — Usuários |
| UC-46-Decisão | [UC-46](UC-46-visualizar-consultor-vinculado-a-clinica.md) | Decisão de produto pendente | `/clinic/consultant/transfer` (RN-03, listada como Alta na Seção 2) está completamente quebrada e mal direcionada em termos de role. | (a) remover (a lógica real de vínculo já existe do lado do consultor, UC-24 a UC-27); (b) corrigir para funcionar como via alternativa de vínculo iniciada pela clínica. | Gestão de Clínica / Consultores |
| UC-49-RN-01 | [UC-49](UC-49-visualizar-perfil-proprio-do-consultor.md) | Decisão de produto pendente | Diferente de UC-38 (System Admin) e UC-41 (usuário de clínica), o Consultor não tem nenhum mecanismo de autoatendimento para editar nome/senha — só orientação para contatar o suporte. | Confirmar se é intencional (delegar sempre ao suporte/System Admin) ou lacuna de funcionalidade a implementar. | Portal do Consultor |

---

## 5. Código Morto / Rotas Órfãs Confirmadas

Candidatos a limpeza (`chore:`), não a "correção" propriamente dita — confirmados por leitura de código e/ou busca exaustiva no repositório.

- **`accessRequestService.createAccessRequest()`** (client-side) — nunca chamada por nenhuma tela; faria correspondência de solicitação por CNPJ/documento com tenant existente. Confirmado em [UC-01](UC-01-solicitar-acesso-ao-sistema.md) (seção 14) e [UC-05](UC-05-vincular-se-automaticamente-a-clinica-sem-consultor.md) (RN-03).
- **Fluxo inteiro "Aprovar Solicitação pela Própria Clínica"** (`clinic/access-requests`, botão "Aprovar") — `approveAccessRequest()` depreciada, sempre falha; candidato a remoção junto com a decisão de produto do UC-05.
- **Rota órfã `/clinic/inventory/audit`** — sem nenhum link de navegação em todo o sistema (mesmo padrão do antigo `/activate`, já removido). Confirmado em [UC-14](UC-14-auditar-e-corrigir-inconsistencias-de-inventario.md).
- **`src/lib/services/tenantService.ts`** — service legado (baseado em Cloud Functions `httpsCallable`) que chama uma função `"createTenant"` inexistente em `functions/src/`. Confirmado em [UC-21](UC-21-cadastrar-nova-clinica.md) (RNF-03).
- **`consultantService.ts`: `transferConsultant`, `removeConsultant`, `searchConsultants`** — reimplementam client-side a mesma lógica das rotas de API realmente usadas, mas nunca são chamadas. Confirmado em [UC-23](UC-23-vincular-alterar-remover-consultor-da-clinica.md) (RN-06).
- **`POST /api/consultants/claims/[id]/approve` e `/reject`** — implementam um fluxo antigo de aprovação manual de vínculo consultor-clínica, superado pelo auto-link; código morto duplo (sem gatilho de UI e sem dado de entrada possível, já que nada cria uma claim `pending`). Confirmado em [UC-24](UC-24-vincular-se-automaticamente-a-clinica-sem-consultor.md) (RN-05).
- **`consultantService.ts`: `createConsultant`** — nunca chamada; a tela usa exclusivamente a API route. Confirmado em [UC-28](UC-28-cadastrar-consultor.md) (RN-06).
- **`DELETE /api/consultants/[id]`** — implementaria a desativação real do consultor (desabilita Auth + zera claims), mas nenhuma tela a chama. Confirmado em [UC-29](UC-29-editar-suspender-e-reativar-consultor.md) (RN-02).
- **`masterProductService.ts`: `deleteMasterProduct`** — hard delete de produto do catálogo master, nunca chamado por nenhuma tela. Confirmado em [UC-32](UC-32-editar-ativar-e-desativar-produto-no-catalogo-master.md) (RN-04).
- **Ramo de UI/lógica "consultor" no diálogo "Editar Usuário"** (`admin/users`) — inalcançável, já que consultores são filtrados antes de compor a lista exibida por essa tela. Confirmado em [UC-36](UC-36-editar-usuario-e-alterar-status-cross-tenant.md) (RN-04).
- **Rota órfã `/clinic/users`** — sem nenhum link de navegação; a única via real é a aba "Usuários" de `/clinic/my-clinic`. Confirmado em [UC-40](UC-40-criar-usuario-para-a-propria-clinica.md) (RN-09).
- **Rota órfã `/clinic/alerts`** — sem nenhum link de navegação em todo o sistema. Confirmado em [UC-42](UC-42-executar-verificacoes-de-alertas-manualmente.md) (RN-06).
- **Rota órfã `/clinic/settings`** — sem nenhum link de navegação em todo o sistema. Confirmado em [UC-43](UC-43-configurar-preferencias-de-notificacao.md) (RN-06).
- **`notificationService.ts`: `createRequestApprovedNotification`, `createRequestRejectedNotification`** — funções completas, com ícone próprio já implementado em `NotificationBell`, mas nunca chamadas. Os tipos `request_created` e `new_user` também nunca geram nenhuma notificação real em todo o código-fonte. Confirmado em [UC-44](UC-44-consultar-e-gerenciar-notificacoes-recebidas.md) (RN-03).
- **`reportService.ts`: `exportToCSV`** — função de exportação alternativa, nunca chamada por `ReportsView` nem por nenhum outro ponto do código. Confirmado em [UC-47](UC-47-gerar-relatorios-de-estoque-vencimento-e-consumo.md) (RN-05).
- **Chamada `fetch` sem uso do resultado** em `ClinicDetailPage` (`GET /api/tenants/{id}/consultant`, dentro de `loadTenantData`) — resquício de código sem efeito observável. Confirmado em [UC-48](UC-48-consultar-clinicas-vinculadas-e-estoque.md) (RN-01).

---

## 6. Itens Resolvidos

Nenhum item nesta primeira versão do mapa — levantamento inicial, todos os achados extraídos entram como "Aberto".

---

## 7. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | uc-issues-tracker | Levantamento inicial a partir de UC-01 a UC-49. 146 itens classificados por severidade (6 Crítica, 23 Alta, 35 Média, 82 Baixa), 12 decisões de produto pendentes e 16 itens de código morto/rotas órfãs consolidados. |
