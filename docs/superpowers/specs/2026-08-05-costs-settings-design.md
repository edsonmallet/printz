# Configuração de Custos Fixos — Design

## Objetivo

Doc único `tenants/{tenantId}/settings/costs` com os parâmetros usados no cálculo de custo/preço de produto (etapa seguinte do MVP): taxa de energia, custo de mão de obra, custos fixos mensais, horas produtivas mensais e markup padrão.

## Escopo

- Form de leitura/escrita do doc único `settings/costs`.
- Sem histórico, sem versionamento — sempre sobrescreve o doc atual (`setDoc`).
- Fora de escopo: qualquer cálculo de custo de produto (próxima etapa, que consome esses valores).

## Arquitetura

Segue o padrão de `modules/materials` / `modules/printers`, mas simplificado por ser doc único (sem lista, sem create/edit/delete separados):

- `modules/costs-settings/services/costs-settings.schema.ts` — Zod schema.
- `modules/costs-settings/services/costs-settings.service.ts` — `useCostsSettings(tenantId)` hook (`onSnapshot` no doc `tenants/{tenantId}/settings/costs` + `queryClient.setQueryData`) e `saveCostsSettings(tenantId, input)` (`setDoc`, overwrite completo).
- `modules/costs-settings/components/costs-settings-form.tsx` — form direto na página (sem Dialog), botão "Salvar", RHF + zodResolver. Se o doc ainda não existir, form abre com todos os campos zerados; salvar cria o doc.

## Dados

```
tenants/{tenantId}/settings/costs
  energyRateKwh: number (>0)          // R$/kWh
  laborCostPerHour: number (>0)       // R$/hora
  monthlyFixedCosts: number (>0)      // R$/mês
  monthlyProductiveHours: number (>0) // horas/mês
  defaultMarkup: number (>0)          // multiplicador, ex: 2.5
```

## UI

Terceira aba "Custos" em `/settings/resources` (junto de Materiais/Impressoras), reaproveitando o `Tabs` já existente em `modules/resources/components/resources-page-content.tsx`.

## Segurança

Nenhuma mudança em `firestore.rules` — o bloco `match /settings/{settingsDoc}` já existente (leitura membro, escrita admin) cobre `settings/costs`.

## Testes

Unitário do schema Zod (todos os 5 campos > 0).

## Ordem de implementação

1. Schema Zod + teste
2. Service (`useCostsSettings` + `saveCostsSettings`)
3. Form component
4. Adicionar aba "Custos" em `resources-page-content.tsx`
