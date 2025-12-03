# Configuração do Apple Wallet Pass

## Estrutura de Arquivos

```
wallet/
├── certificates/
│   ├── pass-cert.p12          # Certificado P12 da Apple (não versionado)
│   ├── wwdr.pem               # Certificado WWDR da Apple
│   └── Apple Worldwide Developer Relations Certification Authority.pem
├── pass-templates/
│   └── pass.json              # Template do passe
└── README.md
```

## Configuração dos Certificados

### 1. Obter Certificados da Apple

1. Acesse [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list/passTypeId)
2. Crie um Pass Type ID: `pass.popupsystem.com.br`
3. Baixe o certificado e exporte como `.p12` com senha
4. Salve como `wallet/certificates/pass-cert.p12`

### 2. Certificado WWDR

O arquivo `Apple Worldwide Developer Relations Certification Authority.pem` já deve estar na pasta `wallet/certificates/`.

### 3. Variáveis de Ambiente

Adicione ao `.env`:

```env
WALLET_CERTIFICATES_PATH=/caminho/absoluto/para/wallet/certificates
NEXT_PUBLIC_BASE_URL=https://seu-dominio.com
```

## Configuração do Domínio

### Cloudflare (ou seu provedor DNS)

1. Crie um subdomínio: `pass.popupsystem.com.br`
2. Aponte para o mesmo servidor da aplicação
3. Configure SSL/HTTPS (obrigatório para Apple Wallet)

### Apple Developer Portal

1. No Pass Type ID, configure o Web Service URL:
   - `https://pass.popupsystem.com.br/api/wallet/v1`
2. Configure o Website Push ID (se necessário)

## Testando

1. Gere um passe através do botão "Gerar Wallet" na home
2. Abra o arquivo `.pkpass` no iPhone
3. O passe será adicionado à Wallet automaticamente

## Atualizações Automáticas

O passe será atualizado automaticamente quando:
- O horário do agendamento mudar (reagendamento)
- O status mudar (cancelamento, confirmação)
- O cliente cancelar

As atualizações são enviadas via Push Notification para todos os dispositivos registrados.

## Notas Importantes

- O certificado P12 deve ser mantido seguro e não versionado no Git
- Adicione `wallet/certificates/*.p12` ao `.gitignore`
- O domínio deve ter HTTPS válido
- O Web Service URL deve estar acessível publicamente

