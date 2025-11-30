# Configuração no Apple Developer Portal

## Passo a Passo

### 1. Acessar o Portal
- Acesse: https://developer.apple.com/account/resources/identifiers/list/passTypeId
- Faça login com sua conta Apple Developer

### 2. Encontrar ou Criar o Pass Type ID
- Procure por: `pass.teste.popupsystem.com.br`
- Se não existir, clique em **"+"** para criar um novo
- Se já existir, clique nele para editar

### 3. Configurar Web Service URL
- No campo **"Web Service URL"**, adicione:
  ```
  https://pass.teste.popupsystem.com.br/api/wallet/v1
  ```
- Clique em **"Save"** ou **"Continue"**

### 4. Verificar Configurações
Certifique-se de que:
- ✅ Pass Type ID: `pass.teste.popupsystem.com.br`
- ✅ Team ID: `7ZB2L2RLB2`
- ✅ Web Service URL: `https://pass.teste.popupsystem.com.br/api/wallet/v1`

## Importante

- O Web Service URL deve estar acessível publicamente
- Deve usar HTTPS (não HTTP)
- O subdomínio deve estar configurado e funcionando
- Pode levar alguns minutos para a Apple processar as alterações

## Próximo Passo

Após configurar, você pode testar gerando um passe na aplicação!

