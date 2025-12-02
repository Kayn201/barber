#!/bin/bash

echo "=========================================="
echo "  DIAGNÓSTICO DO SISTEMA BARBEARIA"
echo "=========================================="
echo ""

echo "=== 1. STATUS DO PM2 ==="
pm2 status
echo ""

echo "=== 2. VERIFICAR PORTA 3000 ==="
if netstat -tulpn 2>/dev/null | grep -q ":3000"; then
    echo "✓ Porta 3000 está em uso:"
    netstat -tulpn 2>/dev/null | grep ":3000"
else
    echo "✗ Porta 3000 NÃO está em uso!"
    echo "  A aplicação não está rodando na porta 3000"
fi
echo ""

echo "=== 3. TESTE DE CONEXÃO LOCAL ==="
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo "✓ Aplicação está respondendo (HTTP $HTTP_CODE)"
else
    echo "✗ Aplicação NÃO está respondendo (HTTP $HTTP_CODE ou erro de conexão)"
    echo "  Tentando conexão direta..."
    curl -v http://localhost:3000 2>&1 | head -10
fi
echo ""

echo "=== 4. STATUS DO NGINX ==="
if systemctl is-active --quiet nginx; then
    echo "✓ Nginx está rodando"
    systemctl status nginx --no-pager | head -3
else
    echo "✗ Nginx NÃO está rodando!"
fi
echo ""

echo "=== 5. CONFIGURAÇÃO DO NGINX ==="
if [ -f /etc/nginx/sites-available/barbearia ]; then
    echo "✓ Arquivo de configuração existe"
    echo "  Verificando proxy_pass..."
    if grep -q "proxy_pass.*3000" /etc/nginx/sites-available/barbearia; then
        echo "✓ proxy_pass configurado corretamente"
        grep "proxy_pass" /etc/nginx/sites-available/barbearia | head -1
    else
        echo "✗ proxy_pass não encontrado ou incorreto"
    fi
else
    echo "✗ Arquivo de configuração não encontrado!"
fi
echo ""

echo "=== 6. ÚLTIMOS ERROS DO PM2 (10 linhas) ==="
pm2 logs barbearia --err --lines 10 --nostream 2>/dev/null || echo "Nenhum log de erro encontrado"
echo ""

echo "=== 7. ÚLTIMOS LOGS DO NGINX (10 linhas) ==="
if [ -f /var/log/nginx/error.log ]; then
    tail -10 /var/log/nginx/error.log
else
    echo "Arquivo de log do Nginx não encontrado"
fi
echo ""

echo "=== 8. VERIFICAR VARIÁVEIS DE AMBIENTE ==="
if [ -f /var/www/barber/.env ]; then
    echo "✓ Arquivo .env encontrado"
    echo "  DATABASE_URL: $(grep DATABASE_URL /var/www/barber/.env | cut -d'=' -f2 | cut -c1-30)..."
    echo "  NEXTAUTH_URL: $(grep NEXTAUTH_URL /var/www/barber/.env | cut -d'=' -f2)"
    echo "  NODE_ENV: $(grep NODE_ENV /var/www/barber/.env | cut -d'=' -f2)"
else
    echo "✗ Arquivo .env não encontrado em /var/www/barber/"
fi
echo ""

echo "=== 9. VERIFICAR PROCESSO NEXT.JS ==="
if pgrep -f "next-server" > /dev/null; then
    echo "✓ Processo Next.js encontrado:"
    ps aux | grep "next-server" | grep -v grep | head -1
else
    echo "✗ Processo Next.js NÃO encontrado"
fi
echo ""

echo "=========================================="
echo "  RESUMO"
echo "=========================================="
echo ""
echo "Para ver logs em tempo real:"
echo "  pm2 logs barbearia"
echo ""
echo "Para reiniciar a aplicação:"
echo "  pm2 restart barbearia"
echo ""
echo "Para ver logs do Nginx:"
echo "  tail -f /var/log/nginx/error.log"
echo ""

