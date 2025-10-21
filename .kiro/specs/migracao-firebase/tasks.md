# Plano de Implementação - Migração do Sistema para Firebase

- [x] 1. Configurar projeto Firebase e dependências





  - Configurar projeto "Curva Mestra" no Firebase Console com todos os serviços necessários
  - Instalar Firebase CLI globalmente e fazer login
  - Inicializar Firebase no projeto atual com hosting, functions, firestore e auth
  - Configurar chave de API (AIzaSyBtNXznf7cvdzGCcBym84ux-SjJrrKaSJU) no frontend
  - Instalar dependências Firebase SDK no frontend e backend
  - _Requisitos: 1.1, 2.1, 3.1, 4.1_

- [x] 2. Configurar Firebase Authentication





  - Habilitar provedores de autenticação (email/senha) no Firebase Console
  - Implementar Firebase Auth no frontend substituindo JWT atual
  - Criar sistema de custom claims para roles (admin, doctor, receptionist, manager)
  - Desenvolver função para migração de usuários PostgreSQL para Firebase Auth
  - Implementar middleware de autenticação nas Firebase Functions
  - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2.1 Criar script de migração de usuários


  - Desenvolver script para extrair usuários do PostgreSQL
  - Implementar criação de usuários no Firebase Auth mantendo IDs
  - Configurar custom claims baseados nos roles existentes
  - Validar migração de todos os usuários
  - _Requisitos: 2.4_

- [x] 3. Configurar Firestore e estrutura de dados





  - Configurar Firestore no modo produção
  - Criar estrutura de coleções baseada no design (clinics/{clinicId}/...)
  - Implementar regras de segurança do Firestore baseadas em roles
  - Configurar índices compostos para consultas complexas
  - Testar regras de segurança com Firebase Emulator
  - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 3.1 Desenvolver script de migração de dados


  - Criar mapeamento completo PostgreSQL → Firestore
  - Implementar transformação de tipos de dados (timestamps, booleans)
  - Desenvolver script de migração por lotes para evitar timeouts
  - Implementar validação de integridade após migração
  - Criar backup dos dados PostgreSQL antes da migração
  - _Requisitos: 3.2, 3.4_

- [x] 4. Migrar API REST para Firebase Functions





  - Configurar estrutura de Firebase Functions com TypeScript
  - Converter endpoints de produtos (/api/products) para Cloud Functions
  - Migrar endpoints de solicitações (/api/requests) para Cloud Functions
  - Converter endpoints de pacientes (/api/patients) para Cloud Functions
  - Migrar endpoints de notas fiscais (/api/invoices) para Cloud Functions
  - Implementar middleware de validação e tratamento de erros
  - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4.1 Implementar autenticação nas Functions


  - Configurar verificação de Firebase Auth em todas as functions
  - Implementar verificação de custom claims para autorização
  - Criar middleware para validação de clínica do usuário
  - Implementar rate limiting e validações de segurança
  - _Requisitos: 4.3, 4.5_

- [x] 5. Adaptar frontend para Firebase





  - Substituir axios/fetch por Firebase SDK no frontend
  - Implementar Firebase Auth no contexto de autenticação React
  - Migrar operações de dados para Firestore SDK
  - Configurar listeners em tempo real para atualizações automáticas
  - Implementar cache offline com Firestore
  - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5.1 Atualizar componentes de autenticação


  - Modificar LoginForm para usar Firebase Auth
  - Atualizar AuthContext para gerenciar estado Firebase
  - Implementar verificação de custom claims no frontend
  - Configurar redirecionamento baseado em roles
  - _Requisitos: 2.1, 2.2, 2.3, 5.3_

- [x] 6. Implementar sistema de notificações Firebase





  - Criar Cloud Functions para alertas de produtos vencendo (scheduler)
  - Implementar triggers para alertas de estoque baixo
  - Desenvolver sistema de notificações em tempo real no frontend
  - Configurar Firebase Cloud Messaging para notificações push (opcional)
  - Criar coleção de notificações no Firestore
  - _Requisitos: 5.4_

- [x] 7. Configurar Firebase Hosting





  - Configurar firebase.json para hosting com regras de SPA
  - Otimizar build do React para produção
  - Configurar headers de cache para assets estáticos
  - Implementar redirecionamentos necessários
  - Configurar domínio customizado se necessário
  - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 8. Implementar backup e monitoramento





  - Configurar backup automático do Firestore
  - Implementar Firebase Analytics no frontend
  - Configurar Performance Monitoring
  - Implementar Error Reporting e alertas
  - Criar dashboard de monitoramento de custos
  - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 9. Executar migração de dados em produção





  - Fazer backup completo do sistema atual
  - Executar migração de usuários para Firebase Auth
  - Executar migração de dados PostgreSQL para Firestore
  - Validar integridade de todos os dados migrados
  - Configurar redirecionamento do sistema antigo
  - _Requisitos: 3.2, 3.4, 2.4_

- [x] 10. Testes de integração e validação








  - Executar testes end-to-end em ambiente Firebase
  - Validar todas as funcionalidades do sistema original
  - Testar performance e tempos de resposta
  - Verificar funcionamento de alertas e notificações
  - Realizar testes de carga básicos
  - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 10.1 Criar testes automatizados para Firebase




  - Implementar testes unitários para Firebase Functions
  - Criar testes de regras de segurança do Firestore
  - Desenvolver testes de integração para fluxos críticos
  - _Requisitos: Todos os requisitos_

- [x] 11. Deploy final e configuração de produção





  - Deploy das Firebase Functions em produção
  - Deploy do frontend no Firebase Hosting
  - Configurar variáveis de ambiente de produção
  - Ativar monitoramento e alertas
  - Documentar URLs e configurações finais
  - _Requisitos: Todos os requisitos_

- [x] 12. Otimização pós-migração





  - Analisar performance das consultas Firestore
  - Otimizar índices baseado no uso real
  - Configurar cache para consultas frequentes
  - Implementar lazy loading onde necessário
  - Monitorar custos e otimizar uso de recursos
  - _Requisitos: 5.2, 8.4, 8.5_

- [x] 12.1 Documentar processo de migração


  - Criar documentação técnica da nova arquitetura
  - Documentar procedimentos de backup e restore
  - Criar guia de troubleshooting comum
  - _Requisitos: 7.5, 8.5_