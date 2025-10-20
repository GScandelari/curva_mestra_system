# Deployment Guide - Sistema de Gestão de Inventário para Clínicas

Este documento fornece instruções completas para deploy em produção do Sistema de Gestão de Inventário para Clínicas de Harmonização.

## Pré-requisitos

### Software Necessário

1. **Docker** (versão 20.10 ou superior)
   - Windows: [Docker Desktop](https://www.docker.com/products/docker-desktop)
   - Linux: [Docker Engine](https://docs.docker.com/engine/install/)

2. **Docker Compose** (versão 2.0 ou superior)
   - Geralmente incluído com Docker Desktop
   - Linux: Instalar separadamente se necessário

3. **OpenSSL** (para certificados SSL)
   - Windows: [Win32/Win64 OpenSSL](https://slproweb.com/products/Win32OpenSSL.html)
   - Linux: Geralmente pré-instalado

### Requisitos do Sistema

- **CPU**: 2 cores mínimo, 4 cores recomendado
- **RAM**: 4GB mínimo, 8GB recomendado
- **Armazenamento**: 20GB mínimo, 50GB recomendado
- **Rede**: Portas 80, 443, 3001, 5432 disponíveis

## Configuração Inicial

### 1. Preparar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.production.example .env

# Editar com suas configurações
nano .env  # ou seu editor preferido
```

### Variáveis Importantes

```env
# Database
DB_PASSWORD=sua-senha-segura-do-banco

# JWT
JWT_SECRET=sua-chave-jwt-super-secreta-com-pelo-menos-32-caracteres

# Email
EMAIL_HOST=smtp.seu-provedor.com
EMAIL_USER=seu-email@dominio.com
EMAIL_PASSWORD=sua-senha-email

# Domínio
ALLOWED_ORIGINS=https://seudominio.com
VITE_API_BASE_URL=https://seudominio.com/api
```

### 2. Configurar SSL

#### Opção A: Certificados Próprios (Recomendado)
```bash
# Colocar certificados na pasta ssl/
cp seu-certificado.pem ssl/cert.pem
cp sua-chave-privada.pem ssl/key.pem
```

#### Opção B: Certificados Auto-assinados (Desenvolvimento)
```bash
# O script de deploy gerará automaticamente se não existirem
```

## Deploy

### Windows (PowerShell)

```powershell
# Deploy completo
.\scripts\deploy.ps1 deploy

# Verificar saúde dos serviços
.\scripts\deploy.ps1 health

# Ver logs
.\scripts\deploy.ps1 logs
```

### Linux/macOS (Bash)

```bash
# Tornar script executável
chmod +x scripts/deploy.sh

# Deploy completo
./scripts/deploy.sh deploy

# Verificar saúde dos serviços
./scripts/deploy.sh health

# Ver logs
./scripts/deploy.sh logs
```

## Estrutura dos Serviços

### Serviços Docker

1. **postgres** - Banco de dados PostgreSQL
   - Porta: 5432
   - Volume: dados persistentes em `postgres_data`

2. **backend** - API Node.js
   - Porta: 3001
   - Volumes: logs, backups, uploads, SSL

3. **nginx** - Proxy reverso e servidor web
   - Portas: 80 (HTTP), 443 (HTTPS)
   - Serve frontend e proxy para API

4. **backup** - Serviço de backup automático
   - Executa backups programados
   - Mantém histórico de backups

### Volumes e Diretórios

```
projeto/
├── backups/          # Backups do banco de dados
├── logs/             # Logs da aplicação
│   └── nginx/        # Logs do Nginx
├── ssl/              # Certificados SSL
├── uploads/          # Arquivos enviados
└── frontend/dist/    # Build do frontend
```

## Monitoramento

### Script de Monitoramento

```bash
# Linux/macOS
./scripts/monitor.sh all

# Windows (adaptar comandos manualmente)
docker-compose -f docker-compose.production.yml ps
```

### Verificações Automáticas

- **Status dos serviços**
- **Uso de recursos (CPU, memória, disco)**
- **Conectividade do banco de dados**
- **Endpoints da API**
- **Certificados SSL**
- **Status dos backups**

### Health Checks

Todos os serviços possuem health checks configurados:

- **Database**: `pg_isready`
- **Backend**: `GET /health`
- **Nginx**: `GET /health` (proxy para backend)

## Backup e Restauração

### Backup Manual

```bash
# Criar backup
node backend/scripts/backup-database.js create full

# Listar backups
node backend/scripts/backup-database.js list

# Verificar integridade
node backend/scripts/backup-database.js verify /path/to/backup.sql.gz
```

### Backup Automático

O serviço de backup executa automaticamente:
- **Frequência**: Diariamente às 2:00 AM (configurável)
- **Retenção**: 30 dias (configurável)
- **Compressão**: Gzip automático
- **Verificação**: Integridade automática

### Restauração

```bash
# Restaurar do backup
node backend/scripts/restore-database.js restore /path/to/backup.sql.gz --clean

# Criar banco se não existir
node backend/scripts/restore-database.js create-db
```

## Logs

### Localização dos Logs

- **Aplicação**: `logs/app.log`
- **Nginx**: `logs/nginx/access.log`, `logs/nginx/error.log`
- **Backup**: `logs/backup.log`

### Rotação de Logs

- **Aplicação**: Rotação automática (10MB, 5 arquivos)
- **Nginx**: Rotação via logrotate (recomendado)

### Visualização

```bash
# Logs em tempo real
docker-compose -f docker-compose.production.yml logs -f

# Logs específicos de um serviço
docker-compose -f docker-compose.production.yml logs -f backend

# Últimas 100 linhas
docker-compose -f docker-compose.production.yml logs --tail=100
```

## Segurança

### Configurações de Segurança

1. **HTTPS obrigatório** em produção
2. **Rate limiting** configurado
3. **Headers de segurança** (CSP, HSTS, etc.)
4. **Validação de entrada** em todos os endpoints
5. **Logs de auditoria** para operações críticas

### Firewall

Portas que devem estar abertas:
- **80** (HTTP - redireciona para HTTPS)
- **443** (HTTPS)

Portas internas (apenas para containers):
- **3001** (Backend API)
- **5432** (PostgreSQL)

## Troubleshooting

### Problemas Comuns

#### 1. Serviços não iniciam
```bash
# Verificar logs
docker-compose -f docker-compose.production.yml logs

# Verificar recursos
docker stats

# Reiniciar serviços
docker-compose -f docker-compose.production.yml restart
```

#### 2. Banco de dados não conecta
```bash
# Verificar status do PostgreSQL
docker-compose -f docker-compose.production.yml exec postgres pg_isready -U postgres

# Verificar logs do banco
docker-compose -f docker-compose.production.yml logs postgres
```

#### 3. SSL não funciona
```bash
# Verificar certificados
openssl x509 -in ssl/cert.pem -text -noout

# Verificar configuração do Nginx
docker-compose -f docker-compose.production.yml exec nginx nginx -t
```

#### 4. API não responde
```bash
# Verificar health check
curl http://localhost:3001/health

# Verificar logs do backend
docker-compose -f docker-compose.production.yml logs backend
```

### Comandos Úteis

```bash
# Parar todos os serviços
docker-compose -f docker-compose.production.yml down

# Reiniciar serviço específico
docker-compose -f docker-compose.production.yml restart backend

# Executar comando no container
docker-compose -f docker-compose.production.yml exec backend bash

# Limpar volumes (CUIDADO: apaga dados)
docker-compose -f docker-compose.production.yml down -v

# Atualizar imagens
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml up -d
```

## Manutenção

### Atualizações

1. **Fazer backup** antes de qualquer atualização
2. **Testar** em ambiente de desenvolvimento
3. **Aplicar** em horário de menor uso
4. **Verificar** funcionamento após atualização

### Rotina de Manutenção

#### Diária
- Verificar logs de erro
- Confirmar execução dos backups
- Monitorar uso de recursos

#### Semanal
- Verificar integridade dos backups
- Limpar logs antigos
- Atualizar dependências de segurança

#### Mensal
- Revisar certificados SSL
- Analisar métricas de performance
- Planejar atualizações

## Suporte

Para problemas ou dúvidas:

1. Verificar logs da aplicação
2. Consultar este guia de troubleshooting
3. Verificar documentação do Docker
4. Contatar equipe de desenvolvimento

## Checklist de Deploy

- [ ] Variáveis de ambiente configuradas
- [ ] Certificados SSL instalados
- [ ] Firewall configurado
- [ ] Backup inicial criado
- [ ] Serviços iniciados com sucesso
- [ ] Health checks passando
- [ ] Frontend acessível via HTTPS
- [ ] API respondendo corretamente
- [ ] Logs sendo gerados
- [ ] Backup automático configurado
- [ ] Monitoramento ativo