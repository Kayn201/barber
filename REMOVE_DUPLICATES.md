# 🗑️ Remover Arquivos Duplicados no Servidor

## ⚠️ Problema

Arquivos duplicados com " 2.tsx" estão causando conflitos no build.

## ✅ Solução

Execute estes comandos no servidor:

```bash
cd /var/www/barbearia

# 1. Fazer pull das mudanças
git pull origin main

# 2. Remover TODOS os arquivos duplicados
find . -name "* 2.*" -o -name "* 3.*" | grep -v node_modules | xargs rm -f

# 3. Verificar se foram removidos (deve retornar vazio)
find . -name "* 2.*" -o -name "* 3.*" | grep -v node_modules

# 4. Fazer build
npm run build

# 5. Reiniciar aplicação
pm2 restart barbearia
```

## 📝 Nota

Os arquivos duplicados foram adicionados ao `.gitignore` para evitar que sejam commitados novamente.

