#!/bin/bash

# Deploy script for Firebase Hosting
# This script builds the frontend and deploys to Firebase Hosting

set -e

ENVIRONMENT=${1:-staging}
SKIP_BUILD=${2:-false}

echo "🚀 Iniciando deploy do Firebase Hosting para ambiente: $ENVIRONMENT"

# Set working directory to project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI não encontrado. Instalando..."
    npm install -g firebase-tools
fi

# Login check
echo "🔐 Verificando autenticação Firebase..."
if ! firebase projects:list &> /dev/null; then
    echo "❌ Não autenticado no Firebase. Execute: firebase login"
    exit 1
fi

if [ "$SKIP_BUILD" != "true" ]; then
    # Build frontend
    echo "🏗️ Construindo frontend para produção..."
    cd frontend
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "📦 Instalando dependências..."
        npm ci
    fi
    
    # Run production build
    npm run build:production
    
    # Verify build output
    if [ ! -f "dist/index.html" ]; then
        echo "❌ Build não gerou arquivos esperados"
        exit 1
    fi
    
    echo "✅ Build do frontend concluído"
    cd ..
fi

# Deploy to Firebase Hosting
echo "🚀 Fazendo deploy para Firebase Hosting..."

if [ "$ENVIRONMENT" = "production" ]; then
    firebase deploy --only hosting --project production
else
    firebase deploy --only hosting --project staging
fi

# Get hosting URL
if [ "$ENVIRONMENT" = "production" ]; then
    HOSTING_URL="https://curva-mestra.web.app"
else
    HOSTING_URL="https://curva-mestra.web.app"
fi

echo "✅ Deploy concluído com sucesso!"
echo "🌐 URL: $HOSTING_URL"

echo "🎉 Deploy finalizado!"