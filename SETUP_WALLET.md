# Configuração do Apple Wallet - Próximas Etapas

## ✅ Etapa 1: Certificados - CONCLUÍDA
- Certificados colocados em `wallet/certificates/`
- Arquivo P12: `pass_cert_teste.p12` (ou renomeie para `pass-cert.p12`)
- Certificado WWDR: `Apple Worldwide Developer Relations Certification Authority.pem`

## ✅ Etapa 2: Banco de Dados - CONCLUÍDA
- Tabelas `Device` e `PassRegistration` criadas
- Prisma Client atualizado

## ⏭️ Etapa 3: Variáveis de Ambiente

Adicione ao arquivo `.env`:

```env
# Caminho absoluto para os certificados
WALLET_CERTIFICATES_PATH=/Users/kaiokinoshita/Documents/programacao/barbearia/wallet/certificates

# Senha do certificado P12 (se tiver senha)
WALLET_P12_PASSWORD=sua_senha_aqui

# URL base da aplicação (ajuste para produção)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
# Para produção: NEXT_PUBLIC_BASE_URL=https://seu-dominio.com
```

**Importante:** 
- Se o certificado P12 não tiver senha, deixe `WALLET_P12_PASSWORD` vazio ou remova a variável
- Para produção, use a URL completa com HTTPS

## ⏭️ Etapa 4: Configurar Subdomínio no Cloudflare

1. Acesse o painel do Cloudflare
2. Selecione seu domínio
3. Vá em **DNS** > **Records**
4. Adicione um novo registro:
   - **Type:** A ou CNAME
   - **Name:** `pass.teste.popupsystem.com.br`
   - **Target:** Mesmo IP/servidor da aplicação principal
   - **Proxy status:** Desabilitado (DNS only) ou habilitado com SSL
5. Salve o registro

**Aguarde a propagação DNS (pode levar alguns minutos)**

## ⏭️ Etapa 5: Configurar SSL/HTTPS

O Apple Wallet **requer HTTPS**. Configure SSL para o subdomínio:

1. No Cloudflare, vá em **SSL/TLS**
2. Certifique-se de que está em modo **Full** ou **Full (strict)**
3. O Cloudflare gerará automaticamente um certificado SSL para o subdomínio

## ⏭️ Etapa 6: Configurar no Apple Developer Portal

1. Acesse [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list/passTypeId)
2. Encontre ou crie o Pass Type ID: `pass.teste.popupsystem.com.br`
3. Clique em **Edit**
4. Em **Web Service URL**, configure:
   ```
   https://pass.teste.popupsystem.com.br/api/wallet/v1
   ```
5. Salve as alterações

## ⏭️ Etapa 7: Testar Localmente

1. Inicie o servidor:
   ```bash
   npm run dev
   ```

2. Acesse a home page no iPhone (ou simulador iOS)
3. Faça um agendamento confirmado
4. Clique no botão **"Gerar Wallet"** que aparece ao lado do primeiro agendamento
5. O arquivo `.pkpass` será baixado
6. Abra o arquivo - ele será adicionado à Wallet automaticamente

## ⏭️ Etapa 8: Testar Atualizações

1. Reagende um agendamento que tenha um passe na Wallet
2. O passe deve ser atualizado automaticamente na Wallet do iPhone

## Troubleshooting

### Erro: "Certificado P12 não encontrado"
- Verifique se o arquivo está em `wallet/certificates/`
- O código aceita: `pass-cert.p12` ou `pass_cert_teste.p12`

### Erro: "Erro ao processar certificado P12"
- Verifique se a senha está correta em `WALLET_P12_PASSWORD`
- Se não tiver senha, deixe vazio ou remova a variável

### Erro: "Web Service URL não acessível"
- Verifique se o subdomínio está configurado no Cloudflare
- Verifique se o SSL está ativo
- Teste acessando: `https://pass.teste.popupsystem.com.br/api/wallet/v1` no navegador

### O botão "Gerar Wallet" não aparece
- Verifique se está acessando no iPhone (não aparece em Android/Desktop)
- Verifique se há um agendamento confirmado na home

## Próximos Passos Após Configuração

Após tudo configurado, você pode:
- Testar a geração de passes
- Testar atualizações automáticas
- Configurar notificações push (requer certificado APNS adicional)

