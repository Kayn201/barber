# 🔧 Correção de Erros no Servidor

## ❌ Erro: `DATABASE_URL` não encontrado

### Problema:
```
Error: Environment variable not found: DATABASE_URL.
```

### Solução:

1. **Verificar se o arquivo `.env` existe no servidor:**
```bash
cd /var/www/barbearia
ls -la .env
```

2. **Se não existir, criar o arquivo `.env`:**
```bash
nano .env
```

3. **Adicionar a variável `DATABASE_URL` (use a mesma do seu `.env` local):**
```env
DATABASE_URL="postgresql://usuario:senha@host:porta/database?sslmode=require"
```

4. **Salvar e sair** (Ctrl+X, Y, Enter)

5. **Verificar se está correto:**
```bash
cat .env | grep DATABASE_URL
```

## ❌ Erro: `.git can't be found`

### Problema:
```
.git can't be found
```

### Solução:
Este é apenas um **aviso do Husky** (git hooks). Não é crítico e não impede o funcionamento. Pode ser ignorado.

Se quiser desabilitar, edite o `package.json` e remova `husky` do script `prepare`:
```json
"prepare": "prisma generate"
```

## ❌ Erro: Arquivos duplicados (`* 2.ts`, `* 2.tsx`)

### Problema:
Arquivos com " 2" no nome causando conflitos.

### Solução:
Já foram removidos e adicionados ao `.gitignore`. No servidor, execute:

```bash
cd /var/www/barbearia
git pull origin main
find . -name "* 2.*" -type f | grep -v node_modules | xargs rm -f
```

## ✅ Comandos Completos para Atualizar o Servidor:

```bash
# 1. Ir para o diretório
cd /var/www/barbearia

# 2. Fazer pull das mudanças
git pull origin main

# 3. Remover arquivos duplicados (se houver)
find . -name "* 2.*" -type f | grep -v node_modules | xargs rm -f

# 4. Verificar/criar .env com DATABASE_URL
nano .env
# Adicione: DATABASE_URL="sua-connection-string-aqui"

# 5. Gerar Prisma Client
npx prisma generate

# 6. Aplicar mudanças do schema ao banco
npx prisma db push

# 7. Fazer build
npm run build

# 8. Reiniciar aplicação
pm2 restart barbearia
```

## 📝 Nota sobre DATABASE_URL

A `DATABASE_URL` deve ser a mesma que você usa localmente. Copie do seu `.env` local e cole no `.env` do servidor.

Formato:
```
DATABASE_URL="postgresql://usuario:senha@host:porta/database?sslmode=require"
```

Exemplo (Neon, Supabase, etc):
```
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require"
```

