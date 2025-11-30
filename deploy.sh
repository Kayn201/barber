#!/bin/bash

# Script de Deploy Automatizado
# Uso: ./deploy.sh

set -e  # Parar em caso de erro

echo "🚀 Iniciando deploy..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erro: package.json não encontrado. Execute este script na raiz do projeto.${NC}"
    exit 1
fi

# Verificar se PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 não encontrado. Instalando...${NC}"
    npm install -g pm2
fi

echo -e "${GREEN}📦 Fazendo pull do Git...${NC}"
git pull origin main || git pull origin master

echo -e "${GREEN}📥 Instalando dependências...${NC}"
npm install

echo -e "${GREEN}🔧 Gerando Prisma Client...${NC}"
npx prisma generate

echo -e "${GREEN}🗄️  Executando migrations...${NC}"
npx prisma migrate deploy

echo -e "${GREEN}🏗️  Fazendo build da aplicação...${NC}"
npm run build

echo -e "${GREEN}🔄 Reiniciando aplicação com PM2...${NC}"
pm2 restart barbearia || pm2 start ecosystem.config.js

echo -e "${GREEN}✅ Deploy concluído com sucesso!${NC}"
echo ""
echo "📊 Status da aplicação:"
pm2 status

echo ""
echo "📝 Para ver os logs:"
echo "   pm2 logs barbearia"

