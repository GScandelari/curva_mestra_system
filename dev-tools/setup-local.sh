#!/bin/bash

# Script SIMPLIFICADO para setup do ambiente local
# IMPORTANTE: Execute DEPOIS dos emuladores já estarem rodando
#
# Uso:
#   Terminal 1: firebase emulators:start
#   Terminal 2: bash dev-tools/setup-local.sh

set -e

# Carregar NVM e usar Node 20
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20 > /dev/null 2>&1 || nvm install 20

echo "🚀 Setup do Ambiente Local - Curva Mestra"
echo "=========================================="
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Verificar se emuladores estão rodando
echo -e "${YELLOW}🔍 Verificando se os emuladores estão rodando...${NC}"

if ! nc -z 127.0.0.1 8080 2>/dev/null; then
  echo -e "${RED}❌ Firestore Emulator não está rodando!${NC}"
  echo ""
  echo "Execute primeiro em outro terminal:"
  echo "  firebase emulators:start"
  echo ""
  exit 1
fi

if ! nc -z 127.0.0.1 9099 2>/dev/null; then
  echo -e "${RED}❌ Auth Emulator não está rodando!${NC}"
  echo ""
  echo "Execute primeiro em outro terminal:"
  echo "  firebase emulators:start"
  echo ""
  exit 1
fi

echo -e "${GREEN}✅ Emuladores estão rodando!${NC}"
echo ""

# 1. Criar System Admin + Clínicas
echo -e "${YELLOW}👤 Criando System Admin e Clínicas de Teste...${NC}"
if node dev-tools/setup-complete-environment.js; then
  echo -e "${GREEN}✅ Usuários criados${NC}"
else
  echo -e "${RED}❌ Erro ao criar usuários${NC}"
  exit 1
fi
echo ""

# 2. Importar produtos Rennova
echo -e "${YELLOW}📦 Importando catálogo de produtos Rennova...${NC}"
if node scripts/import-master-products.js; then
  echo -e "${GREEN}✅ Produtos importados${NC}"
else
  echo -e "${RED}❌ Erro ao importar produtos${NC}"
  exit 1
fi
echo ""

# 3. Exibir credenciais
echo -e "${GREEN}🎉 Setup concluído com sucesso!${NC}"
echo ""
echo "=========================================="
echo -e "${GREEN}📋 CREDENCIAIS DE ACESSO${NC}"
echo "=========================================="
echo ""
echo -e "${YELLOW}🔐 SYSTEM ADMIN${NC}"
echo "   Email: scandelari.guilherme@curvamestra.com.br"
echo "   Senha: admin123"
echo "   URL:   http://localhost:3000/admin"
echo ""
echo -e "${YELLOW}🏥 CLÍNICA BELLA VITA (Plano Anual)${NC}"
echo "   CNPJ:  34.028.316/0001-03"
echo "   Admin: admin@bellavita.com / bella123"
echo "   User:  maria@bellavita.com / bella123"
echo ""
echo -e "${YELLOW}🏥 ESPAÇO RENOVA (Plano Semestral)${NC}"
echo "   CNPJ:  07.526.557/0001-00"
echo "   Admin: admin@espacorenova.com / renova123"
echo "   User:  carlos@espacorenova.com / renova123"
echo ""
echo "=========================================="
echo -e "${GREEN}🚀 PRÓXIMO PASSO${NC}"
echo "=========================================="
echo ""
echo "Execute em outro terminal (ou este mesmo):"
echo -e "${YELLOW}  npm run dev${NC}"
echo ""
echo "Depois acesse: http://localhost:3000"
echo ""
