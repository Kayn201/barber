# Sistema de Monitoramento de Assinaturas

## Como Funciona

O sistema monitora o status das assinaturas através de **Webhooks do Stripe**, seguindo o padrão de sistemas de pagamento mensal modernos.

## Fluxo de Monitoramento

### 1. Tentativa de Cobrança pelo Stripe

Quando chega a data de renovação de uma assinatura:
- O Stripe tenta cobrar o método de pagamento cadastrado
- Se o pagamento for bem-sucedido → Evento `invoice.payment_succeeded`
- Se o pagamento falhar → Evento `invoice.payment_failed`

### 2. Eventos Webhook Tratados

#### ✅ `invoice.payment_succeeded`
**Quando:** Pagamento bem-sucedido (renovação mensal ou reativação após falha)

**O que faz:**
- Atualiza status da assinatura para `active`
- Atualiza período atual (`currentPeriodStart` e `currentPeriodEnd`)
- Se tiver metadata com `professionalId` e `date`, cria booking automaticamente
- Revalida páginas para atualizar UI em tempo real

#### ❌ `invoice.payment_failed`
**Quando:** Falha no pagamento (cartão bloqueado, saldo insuficiente, etc)

**O que faz:**
- Busca status atual da assinatura no Stripe
- Atualiza status no banco para: `past_due`, `unpaid` ou `canceled`
- **Se cancelada ou unpaid:** Cancela automaticamente todos os bookings futuros
- Revalida páginas para atualizar UI

#### 🔄 `customer.subscription.updated`
**Quando:** Qualquer mudança na assinatura (status, período, cancelamento agendado, etc)

**O que faz:**
- Atualiza todos os campos da assinatura no banco
- **Se cancelada ou unpaid:** Cancela bookings futuros
- **Se reativada:** Mantém bookings existentes (serão criados novos no próximo pagamento)
- Revalida páginas

#### 🗑️ `customer.subscription.deleted`
**Quando:** Assinatura cancelada permanentemente (após múltiplas falhas ou cancelamento manual)

**O que faz:**
- Marca assinatura como `canceled` no banco
- Cancela todos os bookings futuros desta assinatura
- Revalida páginas

## Status de Assinatura

### `active`
- Assinatura ativa e pagamento em dia
- Cliente pode agendar serviços sem pagar novamente

### `past_due`
- Primeira tentativa de pagamento falhou
- Stripe tentará novamente automaticamente
- Cliente ainda pode agendar, mas deve atualizar método de pagamento

### `unpaid`
- Múltiplas tentativas de pagamento falharam
- Assinatura será cancelada em breve pelo Stripe
- Bookings futuros são cancelados automaticamente

### `canceled`
- Assinatura cancelada definitivamente
- Não há mais tentativas de cobrança
- Todos os bookings futuros foram cancelados

## Comportamento do Sistema

### Quando o Cartão é Bloqueado

1. **Primeira tentativa falha:**
   - Stripe envia `invoice.payment_failed`
   - Status muda para `past_due`
   - Sistema mantém bookings futuros (dá chance de corrigir)

2. **Tentativas subsequentes falham:**
   - Stripe tenta novamente automaticamente (configurável no dashboard)
   - Se continuar falhando, status muda para `unpaid`
   - Sistema cancela bookings futuros automaticamente

3. **Cancelamento definitivo:**
   - Stripe envia `customer.subscription.deleted`
   - Sistema marca como `canceled` e cancela todos os bookings

### Quando o Cliente Atualiza o Método de Pagamento

1. Cliente atualiza cartão no Stripe Customer Portal
2. Stripe tenta cobrar novamente
3. Se bem-sucedido:
   - `invoice.payment_succeeded` é enviado
   - Status volta para `active`
   - Sistema reativa a assinatura

## Configuração do Stripe

### Webhooks Necessários

No dashboard do Stripe, configure os seguintes eventos para o endpoint `/api/webhooks/stripe`:

- ✅ `checkout.session.completed`
- ✅ `checkout.session.async_payment_failed`
- ✅ `checkout.session.expired`
- ✅ `invoice.payment_succeeded`
- ✅ `invoice.payment_failed`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`

### Tentativas de Pagamento

O Stripe tenta cobrar automaticamente quando uma assinatura falha:
- **Padrão:** 3 tentativas (configurável no dashboard)
- **Intervalo:** Aumenta progressivamente (1 dia, 3 dias, 5 dias)
- Após esgotar tentativas, assinatura é cancelada

## Segurança

- ✅ Webhooks são verificados usando `stripe-signature` header
- ✅ Apenas eventos assinados com `STRIPE_WEBHOOK_SECRET` são processados
- ✅ Logs detalhados para debugging e auditoria

## Vantagens desta Abordagem

1. **Tempo Real:** Atualizações instantâneas via webhooks
2. **Confiável:** Stripe gerencia tentativas de pagamento automaticamente
3. **Automático:** Sistema cancela bookings quando necessário
4. **Padrão da Indústria:** Segue melhores práticas de sistemas de assinatura

