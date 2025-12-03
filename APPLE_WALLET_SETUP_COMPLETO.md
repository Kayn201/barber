# 🍎 Guia Completo: Configuração do Apple Wallet do Zero

Este guia te leva desde a criação da conta no Apple Developer até ter o wallet pass funcionando no seu servidor.

---

## 📋 Pré-requisitos

- Conta Apple (iCloud)
- Cartão de crédito (para pagar a taxa anual de $99 USD)
- Acesso ao servidor via SSH
- Domínio configurado (no seu caso: `popupsystem.com.br`)

---

## PARTE 1: Apple Developer Account

### Passo 1.1: Criar Conta Apple Developer

1. Acesse: https://developer.apple.com/programs/
2. Clique em **"Enroll"** ou **"Inscrever-se"**
3. Faça login com sua conta Apple (iCloud)
4. Aceite os termos e condições
5. **Pague a taxa anual**: $99 USD (renovação anual)
6. Aguarde a aprovação (pode levar 24-48 horas)

### Passo 1.2: Verificar Status da Conta

1. Acesse: https://developer.apple.com/account/
2. Verifique se aparece **"Active"** no status da conta
3. Anote seu **Team ID** (aparece no canto superior direito)
   - Exemplo: `7ZB2L2RLB2`
   - Você vai precisar disso depois!

---

## PARTE 2: Configurar Pass Type ID

### Passo 2.1: Criar Pass Type ID

1. Acesse: https://developer.apple.com/account/resources/identifiers/list/passTypeId
2. Clique no botão **"+"** (canto superior direito)
3. Selecione **"Pass Type IDs"**
4. Clique em **"Continue"**

### Passo 2.2: Configurar Pass Type ID

1. **Description**: Digite uma descrição
   - Exemplo: `Barbearia Agendamento`
   
2. **Identifier**: Digite o identificador
   - Formato: `pass.com.suadominio.app`
   - **IMPORTANTE**: Use o formato reverso do seu domínio
   - Exemplo: `pass.teste.popupsystem.com.br`
   - ⚠️ **Anote este valor!** Você vai precisar no código

3. Clique em **"Continue"**
4. Revise e clique em **"Register"**

### Passo 2.3: Configurar Certificado para Pass Type ID

1. Na lista de Pass Type IDs, clique no que você acabou de criar
2. Clique em **"Edit"**
3. Role até a seção **"Certificates"**
4. Clique em **"Create Certificate"** ou **"+"**

### Passo 2.4: Criar Certificado P12

1. **Opção A: Criar novo certificado**
   - Clique em **"Create Certificate"**
   - Siga as instruções para criar um CSR (Certificate Signing Request)
   - Faça upload do CSR
   - Baixe o certificado (.cer)

2. **Opção B: Usar certificado existente**
   - Se já tiver um certificado, faça upload

3. **Converter para P12**:
   - Abra o **Keychain Access** no Mac
   - Importe o certificado .cer (arraste e solte)
   - Expanda o certificado e veja a chave privada associada
   - Selecione AMBOS (certificado + chave privada)
   - Clique com botão direito → **"Export 2 items..."**
   - Escolha formato: **"Personal Information Exchange (.p12)"**
   - Defina uma **senha** (⚠️ **ANOTE ESTA SENHA!**)
   - Salve como: `pass-cert.p12`

4. **Se não tiver Mac**:
   - Use um Mac emprestado, ou
   - Use uma ferramenta online (menos seguro), ou
   - Contrate alguém para fazer isso

---

## PARTE 3: Obter Certificado WWDR

### Passo 3.1: Baixar Certificado WWDR

O certificado WWDR (Apple Worldwide Developer Relations) é gratuito e público.

1. Acesse: https://www.apple.com/certificateauthority/
2. Procure por **"Apple Worldwide Developer Relations Certification Authority"**
3. Baixe o certificado **G3** (mais recente)
   - Link direto: https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer

### Passo 3.2: Converter para PEM

No servidor ou no seu computador:

```bash
# Se baixou no servidor
openssl x509 -inform DER -in AppleWWDRCAG3.cer -out wwdr.pem

# Se baixou no Mac/Windows, depois faça upload para o servidor
```

---

## PARTE 4: Configurar no Servidor

### Passo 4.1: Conectar ao Servidor

```bash
ssh seu_usuario@seu_servidor
```

### Passo 4.2: Criar Estrutura de Diretórios

```bash
# Ir para o diretório do projeto
cd /var/www/barber

# Criar diretórios
mkdir -p wallet/certificates
mkdir -p wallet/pass-templates

# Verificar
ls -la wallet/
```

### Passo 4.3: Fazer Upload dos Certificados

**Opção A: Via SCP (do seu computador)**

```bash
# No seu computador (terminal local)
scp /caminho/para/pass-cert.p12 usuario@servidor:/var/www/barber/wallet/certificates/
scp /caminho/para/wwdr.pem usuario@servidor:/var/www/barber/wallet/certificates/
```

**Opção B: Via SFTP (FileZilla, WinSCP, etc)**

1. Conecte ao servidor via SFTP
2. Navegue até: `/var/www/barber/wallet/certificates/`
3. Faça upload de:
   - `pass-cert.p12`
   - `wwdr.pem`

**Opção C: Baixar WWDR diretamente no servidor**

```bash
cd /var/www/barber/wallet/certificates
wget https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer
openssl x509 -inform DER -in AppleWWDRCAG3.cer -out wwdr.pem
rm AppleWWDRCAG3.cer
```

### Passo 4.4: Configurar Permissões

```bash
cd /var/www/barber

# Dar permissões corretas
chmod 644 wallet/certificates/*.p12
chmod 644 wallet/certificates/*.pem
chmod 755 wallet/certificates

# Ajustar propriedade (ajuste conforme seu usuário)
chown -R www-data:www-data wallet
# OU
chown -R seu_usuario:seu_usuario wallet
```

### Passo 4.5: Verificar Arquivos

```bash
ls -la wallet/certificates/

# Deve mostrar:
# -rw-r--r-- 1 www-data www-data 1234 Dec  3 06:00 pass-cert.p12
# -rw-r--r-- 1 www-data www-data 5678 Dec  3 06:00 wwdr.pem
```

---

## PARTE 5: Configurar Variáveis de Ambiente

### Passo 5.1: Editar Arquivo .env

```bash
nano /var/www/barber/.env
```

### Passo 5.2: Adicionar Variáveis

Adicione estas linhas (ajuste conforme necessário):

```bash
# Caminho absoluto para certificados do Wallet
WALLET_CERTIFICATES_PATH=/var/www/barber/wallet/certificates

# Senha do certificado P12 (a senha que você definiu ao exportar)
WALLET_P12_PASSWORD=sua_senha_aqui

# URLs de produção (já devem estar configuradas)
NEXT_PUBLIC_BASE_URL=https://popupsystem.com.br
NEXT_PUBLIC_APP_URL=https://popupsystem.com.br
NEXTAUTH_URL=https://popupsystem.com.br
```

### Passo 5.3: Salvar e Sair

- Pressione `Ctrl + X`
- Digite `Y` para confirmar
- Pressione `Enter`

---

## PARTE 6: Atualizar Código

### Passo 6.1: Verificar Pass Type Identifier

Edite o arquivo: `app/_lib/wallet-pass-generator.ts`

```typescript
// Linha 7 - Deve corresponder ao que você criou no Apple Developer
const PASS_TYPE_IDENTIFIER = "pass.teste.popupsystem.com.br"
// ⚠️ Use o mesmo valor que você configurou no Passo 2.2!
```

### Passo 6.2: Verificar Team Identifier

Edite o arquivo: `app/_lib/wallet-pass-generator.ts`

```typescript
// Linha 8 - Deve ser o seu Team ID
const TEAM_IDENTIFIER = "7ZB2L2RLB2"
// ⚠️ Use o Team ID que você anotou no Passo 1.2!
```

### Passo 6.3: Atualizar nos Outros Arquivos

Verifique e atualize também em:

1. `app/api/wallet/v1/passes/[passTypeIdentifier]/[serialNumber]/route.ts` (linha 8)
2. `app/api/wallet/v1/devices/.../route.ts` (linha 4)
3. `wallet/pass-templates/pass.json` (linhas 3 e 4)

Todos devem ter os mesmos valores:
- `passTypeIdentifier`: O que você criou no Passo 2.2
- `teamIdentifier`: O seu Team ID do Passo 1.2

---

## PARTE 7: Deploy e Teste

### Passo 7.1: Fazer Build

```bash
cd /var/www/barber

# Limpar build anterior
rm -rf .next

# Instalar dependências (se necessário)
npm install

# Gerar Prisma Client
npx prisma generate

# Fazer build
npm run build
```

### Passo 7.2: Reiniciar PM2

```bash
# Reiniciar com novas variáveis de ambiente
pm2 restart barbearia --update-env

# Verificar status
pm2 status

# Ver logs em tempo real
pm2 logs barbearia
```

### Passo 7.3: Testar

1. Acesse seu site: `https://popupsystem.com.br`
2. Faça um agendamento
3. Tente adicionar à Wallet (botão "Adicionar à Wallet")
4. Verifique os logs:

```bash
pm2 logs barbearia | grep -i "wallet\|pass\|certificate"
```

### Passo 7.4: Verificar Erros

Se der erro, verifique:

```bash
# Ver logs detalhados
pm2 logs barbearia --lines 50

# Verificar se os arquivos existem
ls -la /var/www/barber/wallet/certificates/

# Verificar variáveis de ambiente
pm2 env barbearia | grep WALLET

# Testar certificado P12 (vai pedir senha)
openssl pkcs12 -info -in /var/www/barber/wallet/certificates/pass-cert.p12
```

---

## PARTE 8: Checklist Final

Antes de considerar completo, verifique:

- [ ] Conta Apple Developer ativa ($99 USD pago)
- [ ] Pass Type ID criado no Apple Developer Portal
- [ ] Certificado P12 criado e exportado com senha
- [ ] Certificado WWDR baixado e convertido para PEM
- [ ] Arquivos no servidor: `/var/www/barber/wallet/certificates/`
  - [ ] `pass-cert.p12` (ou `pass_cert_teste.p12`)
  - [ ] `wwdr.pem`
- [ ] Variáveis de ambiente configuradas no `.env`:
  - [ ] `WALLET_CERTIFICATES_PATH`
  - [ ] `WALLET_P12_PASSWORD`
- [ ] Código atualizado com:
  - [ ] `PASS_TYPE_IDENTIFIER` correto
  - [ ] `TEAM_IDENTIFIER` correto
- [ ] Build feito e PM2 reiniciado
- [ ] Teste realizado e funcionando

---

## 🐛 Troubleshooting

### Erro: "Certificado P12 não encontrado"
- Verifique se o arquivo está em `/var/www/barber/wallet/certificates/`
- Verifique permissões: `chmod 644 wallet/certificates/*.p12`

### Erro: "Erro ao processar certificado P12"
- Verifique se `WALLET_P12_PASSWORD` está correto
- Teste a senha: `openssl pkcs12 -info -in pass-cert.p12`
- Reinicie PM2: `pm2 restart barbearia --update-env`

### Erro: "PassTypeIdentifier inválido"
- Verifique se o valor no código corresponde ao do Apple Developer Portal
- Verifique em todos os arquivos que usam `PASS_TYPE_IDENTIFIER`

### Erro: "Team Identifier inválido"
- Verifique se o Team ID está correto
- Encontre seu Team ID em: https://developer.apple.com/account/

### Wallet não abre no iPhone
- Verifique se o certificado P12 é válido
- Verifique se o Pass Type ID está ativo no Apple Developer
- Teste em um dispositivo físico (não funciona no simulador)

---

## 📞 Recursos Úteis

- **Apple Developer Portal**: https://developer.apple.com/account/
- **Documentação Apple Wallet**: https://developer.apple.com/documentation/walletpasses
- **Certificados Apple**: https://www.apple.com/certificateauthority/
- **Suporte Apple Developer**: https://developer.apple.com/contact/

---

## 💡 Dicas Importantes

1. **Senha do P12**: Anote bem a senha! Você vai precisar dela sempre.
2. **Team ID**: É único para sua conta, não muda.
3. **Pass Type ID**: Deve seguir o formato reverso do domínio.
4. **Certificados**: Não compartilhe os certificados publicamente!
5. **Renovação**: A conta Apple Developer renova anualmente ($99 USD).
6. **Teste**: Sempre teste em dispositivo físico, não no simulador.

---

## ✅ Pronto!

Se seguiu todos os passos, seu Apple Wallet deve estar funcionando! 🎉

Se tiver problemas, verifique os logs com:
```bash
pm2 logs barbearia | grep -i "wallet\|pass\|certificate\|❌\|✅"
```

