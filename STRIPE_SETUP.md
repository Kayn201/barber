# Configuração do Stripe e Autenticação

## Alterações Realizadas

### 1. Checkout Stripe em Português
- ✅ Checkout configurado com `locale: "pt-BR"`
- ✅ Métodos de pagamento: Cartão, PIX (para pagamentos únicos)
- ✅ Apple Pay e Google Pay habilitados automaticamente pelo Stripe quando disponíveis

### 2. Autenticação para Assinaturas
- ✅ Sistema de autenticação completo com NextAuth
- ✅ Providers configurados:
  - Email/Senha (Credentials)
  - Google OAuth
  - Apple OAuth (apenas para iOS)
- ✅ Componente `AuthDialog` criado com formulário de login/cadastro
- ✅ Validação de senha e confirmação de senha
- ✅ Fluxo de checkout atualizado para exigir autenticação em assinaturas

### 3. Schema do Banco de Dados
- ✅ Campo `password` adicionado ao modelo `User` no Prisma

## Próximos Passos

### 1. Configurar Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/fsw-barber?schema=public"

# NextAuth
NEXT_AUTH_SECRET="gere-uma-chave-secreta-aqui"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Google OAuth (opcional, mas recomendado)
GOOGLE_CLIENT_ID="seu-google-client-id"
GOOGLE_CLIENT_SECRET="seu-google-client-secret"

# Apple OAuth (opcional, apenas para iOS)
APPLE_ID="seu-apple-client-id"
APPLE_SECRET="seu-apple-client-secret"

# Stripe
STRIPE_SECRET_KEY="sk_test_51SUANkHHT0Mt1Fx6M79vc5Z4nIbVTiYPnZI6cjZRZ97DZEHpWrePDNpXFpTog3f1HeaXFT6B69q0vO6JHF1lS25Z007NBhpZAv"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_51SUANkHHT0Mt1Fx6AKjePxVE8xlQs1xCbQ7lYobXFGaPdLRklM7BfcZCByL6ytuWfZfodkplYePQ2LSIV0EZX8zi00eU8LAsR3"
STRIPE_WEBHOOK_SECRET="seu-webhook-secret-do-stripe"
```

### 2. Executar Migração do Banco de Dados

```bash
npx prisma migrate dev --name add_password_to_user
```

### 3. Gerar Prisma Client

```bash
npx prisma generate
```

### 4. Gerar Secret do NextAuth

Você pode gerar um secret seguro usando:

```bash
openssl rand -base64 32
```

Ou acesse: https://generate-secret.vercel.app/32

### 5. Configurar OAuth Providers (Opcional)

#### Google OAuth:
1. Acesse https://console.cloud.google.com/
2. Crie um projeto ou selecione um existente
3. Vá em "APIs & Services" > "Credentials"
4. Crie credenciais OAuth 2.0
5. Adicione URLs de redirecionamento autorizadas:
   - `http://localhost:3000/api/auth/callback/google` (desenvolvimento)
   - `https://seu-dominio.com/api/auth/callback/google` (produção)

#### Apple OAuth:
1. Acesse https://developer.apple.com/
2. Crie um App ID e configure Sign in with Apple
3. Configure as URLs de callback

## Funcionalidades Implementadas

### Checkout Stripe
- ✅ Tradução completa em português
- ✅ PIX disponível para pagamentos únicos
- ✅ Apple Pay e Google Pay habilitados automaticamente
- ✅ Suporte a assinaturas recorrentes

### Autenticação
- ✅ Login com email/senha
- ✅ Cadastro com validação de senha
- ✅ Login com Google (ícone)
- ✅ Login com Apple (ícone, apenas iOS)
- ✅ Exigência de autenticação para assinaturas
- ✅ Gerenciamento de sessão com NextAuth

### Fluxo de Assinatura
1. Usuário seleciona serviço de assinatura
2. Ao clicar em "Agendar", se não estiver autenticado, aparece o dialog de login/cadastro
3. Após autenticação, o checkout é criado
4. O Stripe gerencia os pagamentos recorrentes
5. O webhook atualiza o status da assinatura no banco

## Notas Importantes

1. **PIX**: Disponível apenas para pagamentos únicos (não funciona com assinaturas)
2. **Apple Pay**: Aparece automaticamente apenas em dispositivos iOS
3. **Google Pay**: Aparece automaticamente em dispositivos Android
4. **Assinaturas**: Requerem autenticação para gerenciar cancelamentos e renovações
5. **Webhook**: Configure o webhook do Stripe apontando para `/api/webhooks/stripe`

## Testando

1. Execute a migração do banco
2. Configure as variáveis de ambiente
3. Inicie o servidor: `npm run dev`
4. Teste o fluxo de assinatura criando um serviço com `isSubscription: true`
5. Verifique se o dialog de autenticação aparece ao tentar agendar uma assinatura

