@AGENTS.md

# CLAUDE.md — SaaS de Custo e Produção para Impressão 3D

Este arquivo é o contexto de projeto para o Claude Code. Ele consolida todas as decisões de arquitetura tomadas no planejamento. Leia por completo antes de gerar qualquer código.

**Convenção de nomenclatura:** todo o schema (coleções, campos, funções) é em **inglês**. Textos de UI (labels, mensagens) ficam em português, já que o produto é pro mercado brasileiro. Este documento já reflete essa convenção.

---

## 1. O que é o produto

SaaS multi-tenant onde farms de impressão 3D cadastram produtos (com foto e STL de referência), configuram impressoras/materiais/custos, calculam custo e preço sugerido por peça, controlam pedidos num Kanban de produção, e podem terceirizar pedidos a parceiros externos com acesso restrito.

---

## 2. Stack (não sair disso sem necessidade real)

- **Frontend + backend:** Next.js (App Router), Server Actions para operações privilegiadas
- **Auth:** Firebase Authentication (e-mail/senha + Google) + custom claims
- **Banco:** Firestore — um único banco, isolado por `tenantId`
- **Arquivos:** Firebase Storage (fotos + STL)
- **Hosting:** Firebase App Hosting (SSR nativo do Next.js, sem Vercel)
- **Funções privilegiadas:** Cloud Functions (claims, convites, replicação pra parceiros, sync de status)
- **Lint/format:** Biome (não usar ESLint/Prettier — Biome substitui os dois)
- **Estado global (client):** Zustand
- **Dados assíncronos/cache (Firestore, chamadas server):** TanStack Query (React Query)
- **Formulários:** React Hook Form
- **Validação de schema:** Zod (usado tanto no client, junto com React Hook Form via `zodResolver`, quanto no server, validando payload de Server Actions)

---

## 3. Princípios de arquitetura (não quebrar)

1. **Sem motor de fatiamento.** Peso e tempo de impressão são inseridos manualmente por produto. O STL é só arquivo de referência/visualização.
2. **Multi-tenancy por `tenantId`** em custom claims — nunca confiar em `tenantId` vindo do client sem validar contra o claim.
3. **Parceiro nunca lê o tenant original diretamente**, exceto na subcoleção de comentários (única exceção, ver seção 6). Toda leitura de parceiro passa por uma coleção espelhada (`partnerOrders`) com campos explicitamente selecionados — nunca custo, nunca preço de venda, nunca margem.
4. **Dois "valores" que não podem se confundir:**
   - `partnerTotalValue` = o que a farm paga ao parceiro pela produção (parceiro VÊ)
   - Preço de venda ao cliente final / custo interno / margem = a farm nunca expõe isso ao parceiro
5. **Dois "config de impressora" que não podem se confundir:**
   - Perfil de custo (`printers/{id}`: potência, custo de aquisição, vida útil) → só a farm vê, usado no cálculo financeiro
   - Config de impressão do produto (`product.printConfig`: temperatura, velocidade, adesão) → farm e parceiro veem, é o que garante qualidade

---

## 4. Modelo de dados (Firestore) — completo

```
tenants/{tenantId}
  ├─ name, plan, createdAt, ownerId

tenants/{tenantId}/members/{userId}
  ├─ email, displayName, role (admin | member)

tenants/{tenantId}/settings/costs   (doc único)
  ├─ energyRateKwh, laborCostPerHour, monthlyFixedCosts
  ├─ monthlyProductiveHours, defaultMarkup

tenants/{tenantId}/printers/{printerId}
  ├─ name, acquisitionCost, usefulLifeHours, avgPowerKw
  ├─ buildVolumeMm {x, y, z}, notes

tenants/{tenantId}/materials/{materialId}
  ├─ name, pricePerKg, defaultWasteRate, color, density
  ├─ currentStockG              // controle de estoque
  ├─ minStockG                  // gatilho de alerta

tenants/{tenantId}/stockMovements/{movementId}
  ├─ materialId, type (in | out)
  ├─ quantityG
  ├─ source (purchase | order:{orderId} | manual_adjustment)
  ├─ createdAt, createdBy

tenants/{tenantId}/products/{productId}
  ├─ name, description, photoUrl, stlUrl
  ├─ weightG, printTimeH        // manual
  ├─ printerId (ref — perfil de custo), materialId (ref)
  ├─ printConfig: { nozzleTempC, bedTempC, speedMmS, supports, bedAdhesion, notes }
  ├─ lastCalculation: { totalCost, suggestedPrice, calculatedAt }
  ├─ createdAt, updatedAt

tenants/{tenantId}/kanbanColumns/{columnId}
  ├─ name, order

tenants/{tenantId}/orders/{orderId}
  ├─ customer: { name, contact }        // opcional
  ├─ items: [{ productId, name, quantity, materialId, totalWeightG, totalPrintTimeH }]
  ├─ dueDate
  ├─ statusId (coluna atual do kanban)
  ├─ assignedPrinterId (ref — qual máquina física está produzindo)
  ├─ partnerId (null = produção interna)
  ├─ partnerUnitValue, partnerTotalValue   // combinado com o parceiro (se houver)
  ├─ createdAt, updatedAt

tenants/{tenantId}/orders/{orderId}/statusHistory/{entryId}
  ├─ statusId, timestamp, userId

tenants/{tenantId}/orders/{orderId}/comments/{commentId}   // acesso compartilhado, ver seção 6
  ├─ authorUid, authorName, authorType (farm | partner)
  ├─ text, createdAt

partners/{partnerUid}
  ├─ name, email
  ├─ authorizedTenants: [tenantId1, tenantId2, ...]

partnerOrders/{partnerUid}/{orderId}     // espelho, campos liberados
  ├─ tenantId (origem)
  ├─ product: { name, photoUrl, stlUrl, printConfig }
  ├─ quantity, materialName
  ├─ dueDate, statusId
  ├─ partnerTotalValue
```

---

## 5. Estoque de matéria-prima — regras de negócio

- Ao criar um pedido, calcular consumo total = `Σ (weightG do produto × quantity)` por material.
- **Bloquear criação do pedido** se `currentStockG < required consumption` do material necessário (com opção de forçar mesmo assim, mas com alerta explícito).
- Debitar o estoque (`stockMovements` tipo `out`, source `order:{orderId}`) quando o pedido entra em produção (statusId muda de "a produzir" pra "em fila de impressão" — definir o gatilho exato na implementação).
- Entradas de estoque (compra de filamento) são lançadas manualmente em `stockMovements` tipo `in`, atualizando `currentStockG`.
- Se `currentStockG < minStockG`, exibir alerta na tela de materiais ("comprar mais filamento").

---

## 6. Segurança — resumo das regras

| Coleção | Leitura | Escrita |
|---|---|---|
| `tenants/{t}/**` (products, printers, materials, settings, stockMovements) | Membros do tenant `t` | `admin` (configs) / `admin`+`member` (products, orders) |
| `tenants/{t}/orders/{id}/comments/**` | Membros do tenant `t` **OU** `get(tenants/{t}/orders/{id}).data.partnerId == request.auth.uid` | Mesma regra — única exceção de acesso direto cross-tenant |
| `partnerOrders/{partnerUid}/**` | Só `request.auth.uid == partnerUid` | Só `request.auth.uid == partnerUid`, e só o campo `statusId` |
| `partners/{partnerUid}` | O próprio parceiro + tenants que o autorizaram | Tenants gerenciam `authorizedTenants`; parceiro só lê |

**Nunca** dar ao parceiro uma regra que leia diretamente de `tenants/{t}/orders/**`, `tenants/{t}/products/**`, `tenants/{t}/printers/**` ou `tenants/{t}/settings/**` — é assim que custo/preço vazam.

---

## 7. Cloud Functions necessárias

1. `onUserSignup` — cria tenant novo, marca usuário como `admin`
2. `onPartnerInvite` — cria/vincula conta de parceiro, atualiza `authorizedTenants`
3. `onOrderWrite` — se `partnerId` setado, cria/atualiza espelho em `partnerOrders/{partnerId}/{orderId}` com campos whitelisted
4. `onPartnerOrderStatusUpdate` — propaga `statusId` do espelho de volta pro `orders/{orderId}` original + grava em `statusHistory`
5. `onOrderCreate` (estoque) — calcula consumo de material, valida contra `currentStockG`, bloqueia se insuficiente (a menos que forçado)
6. `onOrderStatusChange` (estoque) — debita `currentStockG` e grava `stockMovements` quando pedido entra em produção

---

## 8. Escopo do MVP (tudo abaixo entra na primeira versão)

- [ ] Auth + criação de tenant + convite de membro
- [ ] CRUD de produtos (name, photoUrl, stlUrl, weightG, printTimeH, `printConfig`)
- [ ] CRUD de impressoras (perfil de custo) e materiais (com estoque)
- [ ] Config de custos fixos/energia/mão de obra/markup
- [ ] Cálculo de custo + preço sugerido por produto
- [ ] Controle de estoque de matéria-prima (débito automático, alerta de mínimo, bloqueio de pedido sem estoque)
- [ ] Pedidos + Kanban interno (colunas configuráveis, atribuição de impressora física via `assignedPrinterId`)
- [ ] Cadastro de parceiros + convite
- [ ] Atribuição de pedido a parceiro + espelhamento automático (`partnerOrders`)
- [ ] Kanban do parceiro (visão simplificada, só os pedidos dele)
- [ ] Valor combinado com parceiro (`partnerTotalValue`) visível a ele
- [ ] Comentários no pedido (farm ↔ parceiro)

## 9. Fora do MVP (fase 2+)

- Landing page pública (marketing, `app/(marketing)`)
- Histórico de cálculo de custo (snapshot ao longo do tempo)
- Dashboard de margem por produto/categoria
- Preview 3D do STL no navegador (three.js/react-three-fiber)
- Exportação de orçamento (PDF/Excel)
- Variantes de produto (mesmo produto, materiais diferentes)
- Billing via Stripe, branding/subdomínio por tenant
- Integração com marketplaces (Mercado Livre)
- Multiplicador de peso por preenchimento/suporte (`infillPercent`, `supportsExtraWeightPct`) no cálculo de custo — hoje `weightG` é só manual, sem ajuste automático
- Acréscimo de pós-processamento no cálculo de custo (lixamento, pintura, montagem) — nível configurável por pedido/produto
- Acréscimo de entrega expressa/urgente no preço sugerido (% sobre `suggestedPrice` conforme prazo do pedido)
- Cálculo de custo por quantidade/lote no pedido (hoje o cálculo é por peça em `products`, não agregado em `orders`)

---

## 10. Convenções de código

- Schema (coleções, campos, funções) em **inglês**; textos de UI em **português**.
- Next.js App Router, Server Actions para tudo que envolve Firebase Admin SDK (nunca expor Admin SDK no client).
- Client SDK do Firebase só pra leitura em tempo real (`onSnapshot`) e uploads diretos ao Storage.
- Toda escrita sensível (claims, criação de tenant, convites, espelhamento pra parceiro) passa por Cloud Function — nunca por escrita direta do client em coleções fora do próprio tenant/espelho.

### UI: shadcn/ui

- Toda a interface usa **shadcn/ui**, seguindo os padrões da própria lib (componentes copiados pra `components/ui`, Tailwind + `cn()` helper, variantes via `class-variance-authority`, tokens de tema em `globals.css`).
- Não criar componentes visuais do zero se o shadcn já tem um equivalente (button, dialog, dropdown, form, table, tabs, sonner/toast, etc.) — compor a partir deles.
- Kanban (drag-and-drop) não é nativo do shadcn — implementar como componente próprio dentro do módulo `orders`, mas reaproveitando os primitivos visuais do shadcn (Card, Badge, etc.) pra manter consistência.

### Estrutura de pastas

```
app/                          // SÓ ROTEAMENTO — sem lógica, sem componentes próprios
  (auth)/login/page.tsx
  (dashboard)/products/page.tsx
  (dashboard)/orders/page.tsx
  (dashboard)/partners/page.tsx
  partner/orders/page.tsx      // área do parceiro
  layout.tsx

modules/                      // TODA a lógica e UI de fato vivem aqui
  products/
    components/
    hooks/
    services/                 // chamadas a Firestore/Storage, regras de negócio do módulo
  materials/
    components/
    hooks/
    services/
  printers/
    components/ hooks/ services/
  orders/                     // inclui kanban interno
    components/ hooks/ services/
  partners/                   // cadastro de parceiro + kanban do parceiro
    components/ hooks/ services/
  costs-settings/
    components/ hooks/ services/
  auth/
    components/ hooks/ services/

shared/                       // usado em mais de um módulo
  components/                 // ex: layout, page header, empty state
  hooks/                      // ex: useAuth, useTenant
  services/                   // ex: cliente Firebase, helpers genéricos de Firestore
  utils/
  types/
```

Regra geral: cada `page.tsx` dentro de `app/` só importa e renderiza um componente de página vindo de `modules/{module}/components`. Nenhuma lógica de negócio, chamada a Firestore ou estado complexo dentro de `app/`.

### Uso de cada lib (onde entra o quê)

- **Zustand**: só estado de UI local/global que não vem do servidor (ex: estado do drag-and-drop do Kanban, modais abertos, filtros temporários de tela). Nunca duplicar dado que já vive no Firestore dentro de um store Zustand.
- **TanStack Query**: camada de leitura/cache por cima dos `services` de cada módulo — inclusive envolvendo `onSnapshot` do Firestore quando fizer sentido (ex: via `useQuery` com um listener, ou `queryClient.setQueryData` a partir do snapshot). Toda leitura de dado de servidor passa por aqui, não direto num `useEffect`.
- **React Hook Form + Zod**: todo formulário (produto, impressora, material, pedido, convite) usa RHF com `zodResolver`. O mesmo schema Zod é reaproveitado no server (Server Action) pra validar o payload — schema fica em `modules/{module}/services` ou `shared/types`, nunca duplicado entre client e server.
- **Biome**: substitui ESLint + Prettier — uma única ferramenta pra lint e formatação, configurada na raiz (`biome.json`).

- MVP não precisa de landing page pública — só o app autenticado.
- Reservar uma rota `app/(marketing)/page.tsx` (ou `app/page.tsx` se for a raiz) pra fase 2, com uma landing simples: proposta de valor, screenshots do produto, CTA pra cadastro. Usar shadcn/ui também aqui pra manter consistência visual com o app.

---

## 11. Ordem sugerida de implementação

1. Setup do projeto (Next.js + Firebase, Auth, estrutura de pastas)
2. Auth + criação de tenant + convite de membro
3. CRUD de materiais (com estoque) e impressoras
4. CRUD de produtos + cálculo de custo
5. Config de custos fixos/energia
6. Pedidos + Kanban interno + débito de estoque
7. Cadastro de parceiros + espelhamento de pedidos
8. Kanban do parceiro + sync de status
9. Comentários no pedido

---

## 12. Considerações técnicas adicionais (não esquecer)

- **LGPD**: o sistema guarda dados pessoais (e-mail de membros/parceiros, dados de cliente nos pedidos). Prever política de privacidade, termo de uso, e um mecanismo de exportação/exclusão de dados de um tenant a pedido — mesmo que manual no MVP (via suporte), precisa existir.
- **E-mail transacional**: convite de membro e de parceiro dependem de envio de e-mail. Definir serviço (Resend, SendGrid, ou templates do Firebase Auth) antes de implementar `onPartnerInvite`/convite de membro — sem isso esses fluxos não funcionam.
- **Validação de upload**: aplicar tipo e tamanho de arquivo tanto no client quanto nas Storage Rules — ex: STL até 50MB, foto até 5MB, extensões permitidas (`.stl`, `.jpg`, `.png`, `.webp`). Sem isso, qualquer usuário autenticado pode subir arquivo de qualquer tamanho/tipo.
- **Índices do Firestore**: declarar em `firestore.indexes.json` antes de ir pra produção — no mínimo: `orders` por (`tenantId`, `statusId`), `orders` por (`tenantId`, `assignedPrinterId`), `partnerOrders` por (`partnerUid`, `dueDate`). Query composta sem índice declarado falha em runtime, não em build.
- **Ambientes separados**: projeto Firebase de desenvolvimento/staging distinto do de produção, desde o primeiro commit — evita testar em cima de dado real de cliente mais adiante.
- **Testes mínimos**:
  - Unitários na função de cálculo de custo (é lógica pura, fácil de testar, e é literalmente onde o dinheiro é calculado — qualquer bug aqui é grave).
  - Testes de Security Rules com `@firebase/rules-unit-testing`, focados especialmente em garantir que um parceiro nunca consegue ler `products`, `printers` ou `settings` do tenant, e que só consegue escrever `statusId` em `partnerOrders`.
