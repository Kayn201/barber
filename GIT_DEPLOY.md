# Guia de Deploy via Git

## 📤 Passo 1: Fazer Commit e Push das Mudanças

### 1.1 Verificar o status do Git
```bash
git status
```

### 1.2 Adicionar todos os arquivos modificados
```bash
git add .
```

### 1.3 Fazer commit das mudanças
```bash
git commit -m "fix: resolver conflitos de merge e corrigir erros de reembolso

- Resolvidos todos os conflitos de merge mantendo funcionalidades
- Corrigido erro de refundId (campo não existe no schema)
- Corrigido erro de refundedAt (usar updatedAt)
- Adicionado tratamento para charge_already_refunded
- Adicionado filtro isRefunded: false na home e bookings
- Removido apiVersion do Stripe (usa versão padrão)
- Recriado arquivo get-confirmed-bookings.ts
- Atualizado schema Prisma com campos necessários"
```

### 1.4 Fazer push para o repositório
```bash
git push origin main
# ou
git push origin master
```

## 📥 Passo 2: Atualizar no Servidor

### 2.1 Conectar ao servidor
```bash
ssh root@seu-ip-ou-dominio
```

### 2.2 Ir para o diretório do projeto
```bash
cd /var/www/barbearia
```

### 2.3 Fazer pull das mudanças
```bash
git pull origin main
# ou
git pull origin master
```

### 2.4 Executar migrations (se houver mudanças no schema)
```bash
npx prisma generate
npx prisma migrate deploy
```

### 2.5 Reinstalar dependências (se necessário)
```bash
npm install
```

### 2.6 Fazer build
```bash
npm run build
```

### 2.7 Reiniciar a aplicação
```bash
pm2 restart barbearia
```

## 🔄 Script Automatizado (Opcional)

Você pode usar o script `deploy.sh` que já está no projeto:

```bash
cd /var/www/barbearia
./deploy.sh
```

Este script faz tudo automaticamente:
- `git pull`
- `npm install`
- `npx prisma generate`
- `npx prisma migrate deploy`
- `npm run build`
- `pm2 restart barbearia`

## ⚠️ Importante

1. **Backup**: Sempre faça backup antes de atualizar em produção
2. **Testes**: Teste localmente antes de fazer push
3. **Variáveis de Ambiente**: Certifique-se de que o `.env` no servidor está correto
4. **Migrations**: Se houver mudanças no schema, execute as migrations

