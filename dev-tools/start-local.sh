#!/bin/bash

# Script para iniciar aplicação local com ambiente completo
# Uso: bash dev-tools/start-local.sh

set -e  # Parar em caso de erro

# Carregar NVM e usar Node 20
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20 > /dev/null 2>&1 || nvm install 20

echo "🚀 Iniciando Curva Mestra - Ambiente Local"
echo "=========================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Função para verificar se porta está em uso
check_port() {
  lsof -ti:$1 > /dev/null 2>&1
}

# Função para aguardar porta estar disponível
wait_for_port() {
  local port=$1
  local service=$2
  local max_attempts=30
  local attempt=0

  echo -e "${YELLOW}⏳ Aguardando $service (porta $port)...${NC}"

  while ! nc -z 127.0.0.1 $port > /dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
      echo -e "${RED}❌ Timeout aguardando $service${NC}"
      return 1
    fi
    sleep 1
  done

  echo -e "${GREEN}✅ $service pronto!${NC}"
  return 0
}

# 1. Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
  echo -e "${RED}❌ npm não encontrado. Instale Node.js primeiro.${NC}"
  exit 1
fi

# 2. Verificar se firebase CLI está instalado
if ! command -v firebase &> /dev/null; then
  echo -e "${RED}❌ Firebase CLI não encontrado.${NC}"
  echo "Instale com: npm install -g firebase-tools"
  exit 1
fi

# 3. Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}📦 Instalando dependências...${NC}"
  npm install
  echo -e "${GREEN}✅ Dependências instaladas${NC}"
  echo ""
fi

# 4. Limpar processos existentes
echo -e "${YELLOW}🧹 Limpando processos anteriores...${NC}"
pkill -f "firebase emulators" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 2
echo -e "${GREEN}✅ Processos limpos${NC}"
echo ""

# 5. Iniciar emuladores Firebase
echo -e "${YELLOW}🔥 Iniciando Firebase Emulators...${NC}"
firebase emulators:start > /tmp/firebase-emulators.log 2>&1 &
FIREBASE_PID=$!
echo "   PID: $FIREBASE_PID"
echo ""

# 6. Aguardar emuladores estarem prontos
wait_for_port 4000 "Emulator UI" || exit 1
wait_for_port 8080 "Firestore" || exit 1
wait_for_port 9099 "Auth" || exit 1
echo ""

# Aguardar mais 3 segundos para garantir inicialização completa
echo -e "${YELLOW}⏳ Aguardando inicialização completa...${NC}"
sleep 3
echo ""

# 7. Criar System Admin + Clínicas
echo -e "${YELLOW}👤 Criando System Admin e Clínicas de Teste...${NC}"
if node dev-tools/setup-complete-environment.js; then
  echo -e "${GREEN}✅ Ambiente configurado${NC}"
else
  echo -e "${RED}❌ Erro ao criar usuários${NC}"
  kill $FIREBASE_PID 2>/dev/null || true
  exit 1
fi
echo ""

# 8. Importar produtos Rennova
echo -e "${YELLOW}📦 Importando catálogo de produtos Rennova...${NC}"
if node scripts/import-master-products.js; then
  echo -e "${GREEN}✅ Produtos importados${NC}"
else
  echo -e "${RED}❌ Erro ao importar produtos${NC}"
  kill $FIREBASE_PID 2>/dev/null || true
  exit 1
fi
echo ""

# 9. Iniciar aplicação Next.js
echo -e "${GREEN}🎉 Ambiente pronto! Iniciando aplicação...${NC}"
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
echo -e "${GREEN}🛠️  FERRAMENTAS${NC}"
echo "=========================================="
echo "   Aplicação:    http://localhost:3000"
echo "   Emulator UI:  http://127.0.0.1:4000"
echo "   Firestore:    http://127.0.0.1:4000/firestore"
echo "   Auth:         http://127.0.0.1:4000/auth"
echo "=========================================="
echo ""
echo -e "${YELLOW}⚠️  Pressione Ctrl+C para parar todos os serviços${NC}"
echo ""

# Iniciar Next.js (foreground)
npm run dev

# Cleanup ao sair
trap "kill $FIREBASE_PID 2>/dev/null || true" EXIT
