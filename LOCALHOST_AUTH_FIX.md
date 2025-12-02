# Correção: Login com Google redirecionando para domínio de produção

## Problema
Ao tentar fazer login com Google em desenvolvimento, o sistema redireciona para `https://popupsystem.com.br` em vez de `http://localhost:3000`.

## Solução Implementada

O código foi atualizado para **forçar localhost em desenvolvimento**, mesmo que `NEXTAUTH_URL` esteja definido com o domínio de produção.

## Verificações Necessárias

### 1. Verificar arquivo `.env`

Abra o arquivo `.env` e verifique se há:
```env
NEXTAUTH_URL=https://popupsystem.com.br
```

**Se existir, você tem 2 opções:**

#### Opção A: Comentar/Remover (Recomendado)
```env
# NEXTAUTH_URL=https://popupsystem.com.br  # Comentado para desenvolvimento
```

#### Opção B: Usar apenas em produção
Remova do `.env` local e adicione apenas no servidor de produção.

### 2. Reiniciar o servidor

Após fazer alterações no `.env`, **sempre reinicie o servidor**:

```bash
# Parar o servidor (Ctrl+C)
# Depois iniciar novamente
npm run dev
```

### 3. Limpar cache do navegador

O NextAuth pode ter cacheado a URL antiga. Limpe o cache ou use modo anônimo:

- **Chrome/Edge:** `Ctrl+Shift+Delete` (Windows) ou `Cmd+Shift+Delete` (Mac)
- Ou use **modo anônimo/privado**

## Como Funciona Agora

O sistema detecta automaticamente se está em desenvolvimento e:
- ✅ Força `http://localhost:3000` em desenvolvimento
- ✅ Ignora `NEXTAUTH_URL` se for domínio de produção em desenvolvimento
- ✅ Usa domínio de produção apenas em produção

## Teste

1. Certifique-se de que o servidor está rodando em `http://localhost:3000`
2. Acesse `http://localhost:3000` (não use o domínio de produção)
3. Tente fazer login com Google
4. Deve redirecionar para `http://localhost:3000` após autenticação

## Se Ainda Não Funcionar

1. **Verifique os logs do servidor** - deve mostrar `NEXTAUTH_URL=http://localhost:3000`
2. **Verifique o console do navegador** - pode haver erros de CORS ou redirect
3. **Verifique o Google Cloud Console** - o redirect URI deve incluir `http://localhost:3000/api/auth/callback/google`

