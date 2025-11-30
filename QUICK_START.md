# Guia Rápido - Configuração Completa

## ✅ Configurações Aplicadas

### 1. Banco de Dados
- ✅ Campo `password` adicionado ao modelo `User`
- ✅ Prisma Client gerado

### 2. Variáveis de Ambiente (.env.local)
- ✅ NextAuth Secret configurado
- ✅ Google OAuth configurado
- ✅ Stripe Keys configuradas
- ⏳ Apple OAuth (deixado para depois)
- ⏳ Stripe Webhook Secret (será configurado via CLI)

## 🚀 Como Testar

### 1. Iniciar o Servidor
```bash
npm run dev
```

### 2. Configurar Stripe CLI (em outro terminal)

#### Instalar Stripe CLI (se ainda não tiver):
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Ou baixe de: https://github.com/stripe/stripe-cli/releases
```

#### Fazer login:
```bash
stripe login
```

#### Iniciar o listener de webhooks:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

#### Copiar o Webhook Secret:
O Stripe CLI exibirá algo como:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

#### Adicionar ao .env.local:
Abra o arquivo `.env.local` e descomente/adicione:
```env
STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxx"
```

#### Reiniciar o servidor Next.js:
Pare o servidor (Ctrl+C) e inicie novamente:
```bash
npm run dev
```

### 3. Testar o Fluxo

1. **Criar um serviço de assinatura** (via painel admin):
   - Acesse `/admin`
   - Crie um serviço com `isSubscription: true`
   - Configure `subscriptionInterval: "month"` (ou "week", "year")

2. **Testar agendamento de assinatura**:
   - Vá para a página inicial
   - Selecione um profissional
   - Escolha o serviço de assinatura
   - Ao clicar em "Agendar", o dialog de login aparecerá
   - Faça login com Google ou crie uma conta com email/senha
   - Complete o checkout no Stripe

3. **Verificar webhooks**:
   - Os eventos aparecerão no terminal do Stripe CLI
   - Verifique se os bookings/subscriptions foram criados no banco

## 🔍 Verificar se está funcionando

### Login com Google:
- O botão do Google deve aparecer no dialog de autenticação
- Ao clicar, deve redirecionar para o Google OAuth

### Login com Email/Senha:
- Preencha o formulário de cadastro
- Faça login com as credenciais criadas

### Checkout Stripe:
- Deve aparecer em português
- Deve mostrar opções de PIX (para pagamentos únicos)
- Apple Pay/Google Pay aparecerão automaticamente se disponíveis

## 📝 Notas Importantes

1. **PIX**: Só funciona para pagamentos únicos, não para assinaturas
2. **Assinaturas**: Sempre exigem autenticação
3. **Webhooks**: O Stripe CLI é necessário apenas para testes locais
4. **Produção**: Configure o webhook no Stripe Dashboard quando for para produção

## 🐛 Troubleshooting

### Erro: "Stripe não está configurado"
- Verifique se as variáveis `STRIPE_SECRET_KEY` estão no `.env.local`
- Reinicie o servidor após adicionar variáveis

### Erro: "Autenticação necessária para assinaturas"
- Isso é esperado! O sistema está funcionando corretamente
- Faça login ou crie uma conta

### Webhook não funciona:
- Certifique-se de que o Stripe CLI está rodando
- Verifique se o `STRIPE_WEBHOOK_SECRET` está configurado
- Verifique os logs do Stripe CLI

### Google OAuth não funciona:
- Verifique se as credenciais estão corretas no `.env.local`
- Verifique se a URL de callback está configurada no Google Console:
  - `http://localhost:3000/api/auth/callback/google`

