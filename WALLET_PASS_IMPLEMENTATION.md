# Implementação do Wallet Pass - O que falta fazer

## 📋 Resumo do que já existe

1. ✅ **Geração de Wallet Pass** - Código existe em `app/_lib/wallet-pass-generator.ts`
2. ✅ **API de geração** - `/api/wallet/generate` existe
3. ✅ **API de atualização** - `/api/wallet/v1/passes/[passTypeIdentifier]/[serialNumber]` existe
4. ✅ **Botão de geração** - `GenerateWalletButton` existe mas está dentro do card de agendamento
5. ✅ **Campo no banco** - `walletPassUrl` existe no modelo `Booking`

## ❌ O que falta implementar

### 1. **Botão "Adicionar à Wallet" ao lado de "AGENDAMENTOS"**

**Localização**: `app/page.tsx` - linha 301-304

**Requisitos**:
- Aparecer SOMENTE para iPhone (detectar via user-agent)
- Aparecer SOMENTE UMA VEZ na aba inicial
- Aparecer ao lado do título "AGENDAMENTOS"
- Gerar wallet pass se o cliente ainda não tiver
- Atualizar wallet pass se já existir

**Implementação necessária**:
```tsx
// Em app/page.tsx, linha ~301
<div className="mb-2 md:mb-3 flex items-center justify-between">
  <h2 className="text-[10px] md:text-xs font-bold uppercase text-gray-400">
    AGENDAMENTOS
  </h2>
  {/* NOVO: Botão Wallet - somente iPhone, somente se tiver agendamento */}
  {upcomingBookings.length > 0 && (
    <AddToWalletButton 
      bookingId={upcomingBookings[0].id}
      hasWalletPass={!!upcomingBookings[0].walletPassUrl}
    />
  )}
</div>
```

### 2. **Componente AddToWalletButton**

**Arquivo**: `app/_components/add-to-wallet-button.tsx` (NOVO)

**Funcionalidades**:
- Detectar se é iPhone
- Se não for iPhone, não renderizar nada
- Gerar wallet pass se não existir
- Atualizar wallet pass se já existir
- Mostrar feedback visual (loading, sucesso, erro)

### 3. **Geração automática de Wallet Pass ao criar booking**

**Localização**: 
- `app/_actions/create-booking.ts` (pagamento único)
- `app/api/webhooks/stripe/route.ts` (assinatura - após criar booking)
- `app/_actions/process-checkout-session.ts` (fallback)

**Implementação**:
- Após criar booking com sucesso, gerar wallet pass automaticamente
- Salvar `walletPassUrl` no booking
- Não bloquear criação do booking se falhar (log apenas)

### 4. **Atualização automática do Wallet Pass**

**Localização**: 
- `app/_actions/reschedule-booking.ts` - Quando reagendar
- `app/_actions/refund-booking.ts` - Quando reembolsar
- `app/_actions/delete-booking.ts` - Quando cancelar

**Implementação**:
- Quando houver mudança no booking, atualizar wallet pass
- Usar API de notificação push do Apple Wallet (se configurado)
- Atualizar `walletPassUrl` se necessário

### 5. **Card idêntico na Wallet mostrando agendamentos em tempo real**

**Localização**: `app/_lib/wallet-pass-generator.ts`

**Mudanças necessárias**:
- O wallet pass atual mostra apenas 1 booking
- Precisa mostrar TODOS os agendamentos ativos (como na tela inicial)
- Atualizar automaticamente quando há mudanças

**Estrutura do pass.json**:
```json
{
  "eventTicket": {
    "headerFields": [
      {
        "key": "totalBookings",
        "label": "AGENDAMENTOS",
        "value": "3 agendamentos"
      }
    ],
    "primaryFields": [
      {
        "key": "nextBooking",
        "label": "PRÓXIMO",
        "value": "Corte de Cabelo - João"
      }
    ],
    "secondaryFields": [
      {
        "key": "date",
        "label": "DATA",
        "value": "28 de dezembro"
      },
      {
        "key": "time",
        "label": "HORÁRIO",
        "value": "14:00 - 15:00"
      }
    ],
    "auxiliaryFields": [
      {
        "key": "professional",
        "label": "PROFISSIONAL",
        "value": "João Silva"
      }
    ],
    "backFields": [
      // Listar TODOS os agendamentos ativos
      {
        "key": "booking1",
        "label": "Agendamento 1",
        "value": "Corte de Cabelo - 28/12 às 14:00"
      },
      {
        "key": "booking2",
        "label": "Agendamento 2",
        "value": "Barba - 30/12 às 10:00"
      }
    ]
  }
}
```

### 6. **Deep Link para agendar rapidamente**

**Localização**: `app/_lib/wallet-pass-generator.ts` - campo `backFields`

**Implementação**:
- Adicionar campo com URL para agendar
- URL deve abrir o app/site diretamente na página de agendamento
- Formato: `https://seu-dominio.com/?action=book&service=...`

### 7. **Sistema de atualização em tempo real**

**Localização**: 
- `app/api/wallet/v1/passes/[passTypeIdentifier]/[serialNumber]/route.ts` (GET)
- Sistema de notificação push (se configurado)

**Implementação**:
- Quando booking mudar, incrementar `lastModified` no pass.json
- Apple Wallet verifica automaticamente se há atualizações
- Retornar pass atualizado quando solicitado

## 📝 Checklist de implementação

### Fase 1: Botão na tela inicial
- [ ] Criar componente `AddToWalletButton`
- [ ] Adicionar ao lado de "AGENDAMENTOS" em `app/page.tsx`
- [ ] Detectar iPhone corretamente
- [ ] Mostrar somente uma vez

### Fase 2: Geração automática
- [ ] Gerar wallet pass ao criar booking (pagamento único)
- [ ] Gerar wallet pass ao criar booking (assinatura)
- [ ] Salvar `walletPassUrl` no booking
- [ ] Tratar erros sem bloquear criação do booking

### Fase 3: Atualização automática
- [ ] Atualizar wallet pass ao reagendar
- [ ] Atualizar wallet pass ao reembolsar
- [ ] Atualizar wallet pass ao cancelar
- [ ] Incrementar `lastModified` para forçar atualização

### Fase 4: Card com múltiplos agendamentos
- [ ] Modificar `wallet-pass-generator.ts` para buscar todos os bookings
- [ ] Atualizar estrutura do pass.json para mostrar múltiplos agendamentos
- [ ] Testar visualização na Wallet

### Fase 5: Deep link e atualização em tempo real
- [ ] Adicionar deep link no pass.json
- [ ] Configurar sistema de notificação push (opcional)
- [ ] Testar atualização automática

## 🔧 Arquivos que precisam ser modificados/criados

### Novos arquivos:
1. `app/_components/add-to-wallet-button.tsx` - Botão para adicionar à Wallet

### Arquivos a modificar:
1. `app/page.tsx` - Adicionar botão ao lado de "AGENDAMENTOS"
2. `app/_actions/create-booking.ts` - Gerar wallet pass automaticamente
3. `app/api/webhooks/stripe/route.ts` - Gerar wallet pass para assinaturas
4. `app/_actions/reschedule-booking.ts` - Atualizar wallet pass
5. `app/_actions/refund-booking.ts` - Atualizar wallet pass
6. `app/_actions/delete-booking.ts` - Atualizar wallet pass
7. `app/_lib/wallet-pass-generator.ts` - Modificar para mostrar múltiplos agendamentos
8. `app/api/wallet/generate/route.ts` - Ajustar para gerar pass com múltiplos agendamentos

## 🎯 Prioridades

1. **ALTA**: Botão na tela inicial + Geração automática
2. **MÉDIA**: Atualização automática ao reagendar/reembolsar
3. **MÉDIA**: Card com múltiplos agendamentos
4. **BAIXA**: Deep link e notificação push

