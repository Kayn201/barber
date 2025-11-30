# Configuração do Stripe CLI para Testes Locais

## Instalação do Stripe CLI

### macOS
```bash
brew install stripe/stripe-cli/stripe
```

### Linux
```bash
# Baixe o binário
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_linux_x86_64.tar.gz
tar -xvf stripe_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin
```

### Windows
Baixe o instalador em: https://github.com/stripe/stripe-cli/releases/latest

## Login no Stripe CLI

1. Execute o comando de login:
```bash
stripe login
```

2. Isso abrirá seu navegador para autenticar. Após autenticar, o CLI estará configurado.

## Testar Webhooks em Localhost

### 1. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

### 2. Em outro terminal, execute o Stripe CLI para encaminhar eventos:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### 3. O Stripe CLI exibirá um webhook signing secret:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

### 4. Copie o secret e adicione ao `.env.local`:
```env
STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxx"
```

### 5. Reinicie o servidor Next.js para carregar a nova variável de ambiente.

## Testar Eventos Específicos

Para testar eventos específicos do Stripe:

```bash
# Testar checkout.session.completed
stripe trigger checkout.session.completed

# Testar customer.subscription.updated
stripe trigger customer.subscription.updated

# Testar invoice.payment_succeeded
stripe trigger invoice.payment_succeeded
```

## Eventos Importantes para o Sistema

O sistema está configurado para receber os seguintes eventos:

1. **checkout.session.completed** - Quando um pagamento é concluído
   - Cria o booking ou subscription no banco
   - Cria o registro de Payment

2. **customer.subscription.updated** - Quando uma assinatura é atualizada
   - Atualiza o status da subscription no banco

3. **invoice.payment_succeeded** - Quando um pagamento recorrente é processado
   - Cria um novo booking para o período da assinatura

## Verificar Logs

O Stripe CLI mostrará todos os eventos recebidos em tempo real:

```
2024-11-18 10:30:15   --> checkout.session.completed [evt_xxx]
2024-11-18 10:30:15  <--  [200] POST http://localhost:3000/api/webhooks/stripe [evt_xxx]
```

## Troubleshooting

### Erro: "No such file or directory"
- Certifique-se de que o Stripe CLI está instalado: `stripe --version`

### Erro: "Connection refused"
- Verifique se o servidor Next.js está rodando na porta 3000
- Verifique se a URL do webhook está correta

### Webhook não está sendo recebido
- Verifique se o `STRIPE_WEBHOOK_SECRET` está configurado corretamente
- Verifique os logs do Stripe CLI
- Verifique os logs do servidor Next.js

## Produção

Quando for para produção, você precisará:

1. Configurar o webhook no Stripe Dashboard
2. Adicionar a URL de produção: `https://seu-dominio.com/api/webhooks/stripe`
3. Copiar o webhook signing secret do Dashboard
4. Adicionar ao `.env.production` ou variáveis de ambiente do seu provedor

