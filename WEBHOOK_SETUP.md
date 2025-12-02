# Configuração de Webhooks do Stripe

## ✅ Status Atual do Sistema

O código do webhook **já está implementado e funcional** em `/app/api/webhooks/stripe/route.ts`. Ele:

- ✅ Verifica assinatura do webhook usando `stripe-signature`
- ✅ Processa todos os eventos necessários
- ✅ Atualiza o banco de dados em tempo real
- ✅ Revalida páginas automaticamente

## 🔧 Configuração Necessária no Stripe Dashboard

Para que os webhooks funcionem em **produção**, você precisa configurar no Stripe Dashboard:

### 1. Acessar Webhooks no Stripe

1. Acesse: https://dashboard.stripe.com/webhooks
2. Clique em **"Add endpoint"** (ou edite um existente)

### 2. Configurar Endpoint

**URL do Endpoint:**
```
https://seu-dominio.com/api/webhooks/stripe
```

**Exemplo:**
```
https://popupsystem.com.br/api/webhooks/stripe
```

### 3. Selecionar Eventos

Selecione os seguintes eventos para enviar ao webhook:

#### Eventos Obrigatórios:
- ✅ `checkout.session.completed` - Pagamento bem-sucedido
- ✅ `checkout.session.async_payment_failed` - Pagamento assíncrono falhou
- ✅ `checkout.session.expired` - Checkout expirado
- ✅ `invoice.payment_succeeded` - Pagamento de assinatura bem-sucedido
- ✅ `invoice.payment_failed` - **Falha no pagamento de assinatura** ⚠️
- ✅ `customer.subscription.updated` - **Atualização de assinatura** ⚠️
- ✅ `customer.subscription.deleted` - **Assinatura cancelada** ⚠️

### 4. Obter Webhook Secret

Após criar o endpoint:
1. Clique no endpoint criado
2. Na seção **"Signing secret"**, clique em **"Reveal"**
3. Copie o secret (começa com `whsec_...`)
4. Adicione no arquivo `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### 5. Testar Webhook

No Stripe Dashboard:
1. Vá para o endpoint criado
2. Clique em **"Send test webhook"**
3. Selecione um evento (ex: `invoice.payment_failed`)
4. Verifique os logs do servidor para confirmar recebimento

## 🧪 Testando Localmente (Desenvolvimento)

Para testar webhooks localmente, você pode usar o **Stripe CLI**:

### Instalar Stripe CLI

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Ou baixar de: https://stripe.com/docs/stripe-cli
```

### Login no Stripe CLI

```bash
stripe login
```

### Encaminhar Webhooks para Localhost

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Isso vai:
1. Criar um webhook endpoint temporário no Stripe
2. Mostrar um `webhook signing secret` (começa com `whsec_...`)
3. Encaminhar eventos para seu servidor local

**Adicione o secret no `.env` local:**
```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### Disparar Evento de Teste

Em outro terminal:
```bash
# Testar falha de pagamento
stripe trigger invoice.payment_failed

# Testar atualização de assinatura
stripe trigger customer.subscription.updated

# Testar cancelamento
stripe trigger customer.subscription.deleted
```

## 📋 Checklist de Verificação

### Código ✅
- [x] Endpoint `/api/webhooks/stripe` implementado
- [x] Verificação de assinatura configurada
- [x] Todos os eventos tratados
- [x] Atualização de banco de dados
- [x] Revalidação de páginas

### Configuração ⚠️
- [ ] Webhook configurado no Stripe Dashboard (produção)
- [ ] `STRIPE_WEBHOOK_SECRET` configurado no `.env` (produção)
- [ ] Eventos selecionados no Stripe Dashboard
- [ ] Testado em produção

## 🔍 Como Verificar se Está Funcionando

### 1. Verificar Logs do Servidor

Quando um webhook é recebido, você verá logs como:
```
🔔 Webhook endpoint chamado!
📝 Signature recebida: Sim
🔑 STRIPE_WEBHOOK_SECRET configurado: Sim
❌ Webhook recebido: invoice.payment_failed
✅ Subscription atualizada para: past_due
```

### 2. Verificar no Stripe Dashboard

1. Acesse: https://dashboard.stripe.com/webhooks
2. Clique no seu endpoint
3. Veja a aba **"Recent deliveries"**
4. Verifique se os eventos estão sendo entregues com sucesso (status 200)

### 3. Testar Manualmente

1. Crie uma assinatura de teste
2. No Stripe Dashboard, vá em **"Customers"** → Selecione o cliente
3. Clique na assinatura
4. Use **"Update payment method"** para simular falha
5. Ou use **"Cancel subscription"** para testar cancelamento
6. Verifique se o status atualiza no seu sistema

## ⚠️ Importante

- **Produção:** Use o webhook secret do Stripe Dashboard
- **Desenvolvimento:** Use o webhook secret do Stripe CLI
- **Nunca compartilhe** o `STRIPE_WEBHOOK_SECRET` publicamente
- Os webhooks funcionam apenas em **HTTPS** em produção

## 🚨 Troubleshooting

### Webhook não está sendo recebido

1. Verifique se a URL está correta no Stripe Dashboard
2. Verifique se o servidor está rodando e acessível
3. Verifique os logs do servidor
4. Verifique se `STRIPE_WEBHOOK_SECRET` está configurado

### Erro "Webhook Error: No signatures found"

- Verifique se o header `stripe-signature` está sendo enviado
- Verifique se `STRIPE_WEBHOOK_SECRET` está correto

### Eventos não estão atualizando o banco

- Verifique os logs do servidor para erros
- Verifique se a assinatura existe no banco (`stripeSubscriptionId`)
- Verifique se o cliente existe no banco

