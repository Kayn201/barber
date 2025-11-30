# Guia de Deploy - Servidor Contabo

## 📋 Pré-requisitos

- Servidor Contabo com Ubuntu (20.04 ou superior)
- Acesso SSH ao servidor
- Domínio configurado apontando para o IP do servidor
- Conta Stripe configurada

## 🚀 Passo 1: Configuração Inicial do Servidor

### 1.1 Conectar ao servidor
```bash
ssh root@seu-ip-ou-dominio
```

### 1.2 Atualizar o sistema
```bash
apt update && apt upgrade -y
```

### 1.3 Instalar Node.js (v20 LTS)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version  # Deve mostrar v20.x.x
```

### 1.4 Instalar PM2 (gerenciador de processos)
```bash
npm install -g pm2
```

### 1.5 Instalar Nginx
```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

### 1.6 Instalar Certbot (para SSL)
```bash
apt install -y certbot python3-certbot-nginx
```

## 🔧 Passo 2: Configurar o Banco de Dados

**IMPORTANTE**: Use o mesmo banco de dados que você já está usando no desenvolvimento.

- Copie a `DATABASE_URL` do seu arquivo `.env` local
- Ela será usada no servidor também (não precisa criar banco novo)

## 📦 Passo 3: Clonar e Configurar o Projeto

### 3.1 Criar diretório do projeto
```bash
mkdir -p /var/www
cd /var/www
```

### 3.2 Clonar o repositório
```bash
git clone https://github.com/seu-usuario/seu-repositorio.git barbearia
cd barbearia
```

### 3.3 Instalar dependências
```bash
npm install
```

### 3.4 Configurar variáveis de ambiente
```bash
nano .env
```

**IMPORTANTE**: Copie todas as variáveis do seu `.env` local, especialmente:

**Variáveis obrigatórias no `.env`:**
```env
# Database (use a mesma DATABASE_URL do seu .env local)
DATABASE_URL="postgresql://usuario:senha@host:porta/database"

# NextAuth (IMPORTANTE: altere a URL para o domínio de produção)
NEXTAUTH_URL="https://seu-dominio.com.br"
NEXTAUTH_SECRET="use-o-mesmo-secret-do-seu-env-local-ou-gere-novo"

# Stripe
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLIC_KEY="pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."  # Será configurado no Passo 6

# Google OAuth (se usar)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Apple OAuth (se usar)
APPLE_ID="..."
APPLE_SECRET="..."

# Wallet (se usar)
WALLET_CERTIFICATES_PATH="/var/www/barbearia/wallet/certificates"
WALLET_PASS_TYPE_IDENTIFIER="pass.teste.popupsystem.com.br"
WALLET_TEAM_IDENTIFIER="7ZB2L2RLB2"
WALLET_WEB_SERVICE_URL="https://pass.teste.popupsystem.com.br/api/wallet/v1"
```

### 3.5 Gerar Prisma Client
```bash
npx prisma generate
```

### 3.6 Executar migrations
```bash
npx prisma migrate deploy
```

## 🏗️ Passo 4: Build da Aplicação

```bash
npm run build
```

## ⚙️ Passo 5: Configurar PM2

### 5.1 Criar arquivo de configuração do PM2
O arquivo `ecosystem.config.js` já está criado no projeto.

### 5.2 Iniciar aplicação com PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Seguir as instruções para iniciar no boot
```

### 5.3 Verificar status
```bash
pm2 status
pm2 logs barbearia
```

## 🌐 Passo 6: Configurar Nginx

### 6.1 Criar configuração do Nginx
O arquivo `nginx.conf` já está criado. Copie para o Nginx:

```bash
cp nginx.conf /etc/nginx/sites-available/barbearia
ln -s /etc/nginx/sites-available/barbearia /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default  # Remover default se existir
```

### 6.2 Editar configuração com seu domínio
```bash
nano /etc/nginx/sites-available/barbearia
```

Altere `seu-dominio.com.br` para seu domínio real.

### 6.3 Testar configuração
```bash
nginx -t
```

### 6.4 Reiniciar Nginx
```bash
systemctl restart nginx
```

## 🔒 Passo 7: Configurar SSL/HTTPS

### 7.1 Obter certificado SSL

**⚠️ IMPORTANTE - Cloudflare Proxy**: Se você tem o **Proxy Status** ativado (ícone laranja) no Cloudflare, você tem 2 opções:

1. **Desabilitar Proxy temporariamente** (mais fácil):
   - No Cloudflare, vá em DNS > Records
   - Clique no ícone laranja (Proxy) para desabilitar (ficará cinza = DNS only)
   - Gere o certificado
   - Depois pode reativar o Proxy

2. **Usar método DNS do Certbot** (mais complexo, mas não precisa desabilitar Proxy)

#### Opção A: Método Standalone (Recomendado se Nginx não está configurado com SSL)

**⚠️ ANTES**: Desabilite o Proxy no Cloudflare (ícone laranja → cinza)

```bash
# 1. Parar Nginx temporariamente
sudo systemctl stop nginx

# 2. Gerar certificados para domínio principal e subdomínio
sudo certbot certonly --standalone -d popupsystem.com.br -d www.popupsystem.com.br -d pass.teste.popupsystem.com.br

# 3. Reiniciar Nginx
sudo systemctl start nginx
```

**Depois disso**, você precisa atualizar manualmente o arquivo `/etc/nginx/sites-available/barbearia` com a configuração completa que inclui SSL (use o arquivo `nginx-completo-final.conf`).

#### Opção B: Método Nginx (Apenas se Nginx já está funcionando sem SSL)

Se você já tem o Nginx rodando com a configuração temporária (sem SSL):

```bash
sudo certbot --nginx -d popupsystem.com.br -d www.popupsystem.com.br -d pass.teste.popupsystem.com.br
```

O Certbot tentará configurar automaticamente, mas pode falhar se houver referências a certificados inexistentes.

### 7.2 Verificar certificados gerados

```bash
# Listar certificados
sudo certbot certificates

# Verificar se os arquivos existem
ls -la /etc/letsencrypt/live/popupsystem.com.br/
```

Você deve ver:
- `fullchain.pem`
- `privkey.pem`

### 7.3 Atualizar configuração do Nginx com SSL

Se usou o método `--standalone`, atualize manualmente:

```bash
sudo nano /etc/nginx/sites-available/barbearia
```

Use a configuração completa do arquivo `nginx-completo-final.conf` que inclui:
- Blocos HTTPS para `popupsystem.com.br`
- Blocos HTTPS para `pass.teste.popupsystem.com.br`
- Referências corretas aos certificados em `/etc/letsencrypt/live/popupsystem.com.br/`

Teste e reinicie:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### 7.4 Renovação automática

O Certbot já configura renovação automática. Teste:
```bash
sudo certbot renew --dry-run
```

A renovação automática está configurada em `/etc/cron.d/certbot` e renova certificados que estão próximos de expirar (30 dias antes).

## 🔔 Passo 8: Configurar Stripe Webhook (IMPORTANTE!)

### 8.1 No Dashboard do Stripe
1. Acesse: https://dashboard.stripe.com/webhooks
2. Clique em **"Add endpoint"**
3. Configure:
   - **Endpoint URL**: `https://seu-dominio.com.br/api/webhooks/stripe`
   - **Events to send**: Selecione:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `invoice.payment_succeeded`
4. Clique em **"Add endpoint"**
5. **Copie o "Signing secret"** (começa com `whsec_`)

### 8.2 Atualizar .env no servidor
```bash
nano /var/www/barbearia/.env
```

Adicione/atualize:
```env
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### 8.3 Reiniciar aplicação
```bash
pm2 restart barbearia
```

## ✅ Passo 9: Verificar Funcionamento

### 9.1 Verificar logs
```bash
pm2 logs barbearia
tail -f /var/log/nginx/error.log
```

### 9.2 Testar webhook do Stripe
1. No Dashboard do Stripe, vá em **Webhooks**
2. Clique no webhook criado
3. Clique em **"Send test webhook"**
4. Verifique os logs: `pm2 logs barbearia`

### 9.3 Testar aplicação
- Acesse: `https://seu-dominio.com.br`
- Teste fazer um agendamento
- Verifique se o webhook está funcionando

## 🔄 Passo 10: Script de Deploy Automatizado

Use o script `deploy.sh` para atualizações futuras:

```bash
chmod +x deploy.sh
./deploy.sh
```

## 📝 Comandos Úteis

### PM2
```bash
pm2 status              # Ver status
pm2 logs barbearia      # Ver logs
pm2 restart barbearia   # Reiniciar
pm2 stop barbearia      # Parar
pm2 delete barbearia    # Remover
```

### Nginx
```bash
nginx -t                # Testar configuração
systemctl restart nginx # Reiniciar
systemctl status nginx  # Ver status
```

### Logs
```bash
pm2 logs barbearia                    # Logs da aplicação
tail -f /var/log/nginx/access.log    # Logs de acesso
tail -f /var/log/nginx/error.log     # Logs de erro
```

## 🐛 Troubleshooting

### Aplicação não inicia
```bash
pm2 logs barbearia --lines 50
# Verificar erros no log
```

### Nginx retorna 502
- Verificar se PM2 está rodando: `pm2 status`
- Verificar porta 3000: `netstat -tulpn | grep 3000`
- Verificar logs do Nginx: `tail -f /var/log/nginx/error.log`

### Webhook não funciona
- Verificar `STRIPE_WEBHOOK_SECRET` no `.env`
- Verificar se o endpoint está acessível: `curl https://seu-dominio.com.br/api/webhooks/stripe`
- Verificar logs: `pm2 logs barbearia`

### SSL não funciona
- Verificar certificado: `certbot certificates`
- Renovar manualmente: `certbot renew`

## 🔐 Segurança

1. **Firewall**: Configure UFW
```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

2. **Backup**: Configure backups regulares do banco de dados
3. **Monitoramento**: Configure alertas no PM2 ou use um serviço de monitoramento

