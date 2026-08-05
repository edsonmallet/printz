# Printz — Roadmap por Etapas + Plano Detalhado da Etapa 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sair de um Next.js recém-criado (só `firebase` instalado, sem Auth, sem shadcn, sem estrutura de módulos) para a base funcional descrita em `CLAUDE.md` — tooling, estrutura de pastas e Auth (login) funcionando.

**Architecture:** Segue à risca `CLAUDE.md` seção 10 — `app/` só roteamento, `modules/{module}/{components,hooks,services}` concentra lógica+UI, `shared/` cross-module. Client SDK Firebase só pra Auth/`onSnapshot`/upload; qualquer coisa privilegiada (claims, criação de tenant) fica pra Etapa 2 via Server Action/Cloud Function.

**Tech Stack:** Next.js 16 (App Router) + Firebase (client + admin) + shadcn/ui + Zustand + TanStack Query + React Hook Form + Zod + Biome.

## Global Constraints

- Schema (coleções, campos, funções) em inglês; texto de UI em português.
- Server Actions pra tudo que usa Firebase Admin SDK — Admin SDK nunca no client.
- Client Firebase SDK só pra `onSnapshot` (leitura realtime) e upload direto ao Storage.
- Biome substitui ESLint+Prettier — não usar as duas.
- Zustand só estado de UI local, nunca duplica dado que já vive no Firestore.
- TanStack Query é a única porta de entrada pra dado de servidor (nada de `useEffect` direto).
- Todo formulário usa RHF + `zodResolver`; schema Zod reaproveitado no server, mora em `modules/{module}/services` ou `shared/types` — nunca duplicado.
- UI só shadcn/ui (`components/ui`, Tailwind + `cn()`), sem componente visual do zero se já existe equivalente.
- `app/**/page.tsx` só importa e renderiza componente de `modules/{module}/components` — zero lógica/chamada Firestore em `app/`.

---

## Roadmap completo (referência — detalhamento task-a-task só na etapa corrente)

1. **Setup do projeto** (Next.js+Firebase, Auth, estrutura de pastas) — **plano detalhado abaixo**
2. Auth + criação de tenant + convite de membro (Cloud Functions `onUserSignup`, `onPartnerInvite`)
3. CRUD de materiais (c/ estoque) e impressoras
4. CRUD de produtos + cálculo de custo (+ testes unitários da função de custo)
5. Config de custos fixos/energia/mão de obra/markup
6. Pedidos + Kanban interno + débito de estoque
7. Cadastro de parceiros + espelhamento de pedidos (`onOrderWrite`)
8. Kanban do parceiro + sync de status (`onPartnerOrderStatusUpdate`)
9. Comentários no pedido

Cada etapa ganha seu próprio plano em `docs/superpowers/plans/` quando for iniciada.

---

## Estado atual verificado

- `package.json`: só `firebase`, `next`, `react`, `react-dom` + toolchain padrão create-next-app (ESLint, Tailwind v4).
- `src/shared/services/firebase.ts` existe mas: config **hardcoded** (não env var), inicializa `getAnalytics` (quebra em SSR — `window` indisponível), não exporta `auth`/`firestore`/`storage`.
- Projeto Firebase real já existe: `printz-1558b` (config visível no arquivo acima).
- Sem shadcn, sem `components.json`, sem `modules/`, sem `.env.local`.
- `.env*` já no `.gitignore`.

---

## Etapa 1 — Tasks

### Task 1: Trocar ESLint por Biome

**Files:**
- Delete: `eslint.config.mjs`
- Modify: `package.json` (scripts `lint`, `format`, remove deps eslint)
- Create: `biome.json`

**Interfaces:** nenhuma (tooling).

- [ ] **Step 1:** Remover ESLint e instalar Biome
  ```bash
  npm uninstall eslint eslint-config-next @eslint/eslintrc
  npm install -D --save-exact @biomejs/biome
  ```
- [ ] **Step 2:** Gerar config base
  ```bash
  npx @biomejs/biome init
  ```
- [ ] **Step 3:** Editar `biome.json` gerado pra este conteúdo:
  ```json
  {
    "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
    "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
    "files": { "ignoreUnknown": false, "ignore": [".next", "node_modules"] },
    "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
    "organizeImports": { "enabled": true },
    "linter": {
      "enabled": true,
      "rules": { "recommended": true, "correctness": { "noUnusedVariables": "error" } }
    },
    "javascript": { "formatter": { "quoteStyle": "double" } }
  }
  ```
- [ ] **Step 4:** Deletar `eslint.config.mjs`, atualizar `package.json`:
  ```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "biome check .",
    "format": "biome format --write ."
  }
  ```
- [ ] **Step 5:** Verificar
  ```bash
  npm run lint
  ```
  Expected: roda sem erro de config (pode reportar findings no código atual — ok, corrige na sequência).
- [ ] **Step 6: Commit**
  ```bash
  git add package.json package-lock.json biome.json
  git rm eslint.config.mjs
  git commit -m "chore: replace ESLint with Biome"
  ```

---

### Task 2: Instalar dependências de estado, dados e formulário

**Files:** `package.json`

- [ ] **Step 1:**
  ```bash
  npm install zustand @tanstack/react-query react-hook-form zod @hookform/resolvers firebase-admin class-variance-authority clsx tailwind-merge lucide-react
  ```
- [ ] **Step 2:** Verificar build ainda passa
  ```bash
  npm run build
  ```
  Expected: build OK (nenhum import novo usado ainda).
- [ ] **Step 3: Commit**
  ```bash
  git add package.json package-lock.json
  git commit -m "chore: add zustand, react-query, RHF, zod, firebase-admin deps"
  ```

---

### Task 3: Inicializar shadcn/ui

**Files:**
- Create: `components.json`
- Create: `src/components/ui/*` (button, input, label, form, card, dialog, table, tabs, badge, sonner, dropdown-menu)
- Create: `src/shared/utils/cn.ts` (ou onde o `shadcn init` colocar `lib/utils.ts` — mover pra `shared/utils/cn.ts` pra seguir convenção de pastas do projeto)

- [ ] **Step 1:**
  ```bash
  npx shadcn@latest init
  ```
  Responder: base color neutral, CSS variables sim, `src/app/globals.css` como arquivo de estilo, alias `@/components` → mas projeto usa `modules/`+`shared/` — aceitar default `src/components/ui` pro `components/ui` gerado (é o padrão shadcn, mantém como está: `components/ui` fica na raiz de `src/`, fora de `modules/`/`shared/`, exatamente como shadcn espera pra facilitar `npx shadcn add` futuro).
- [ ] **Step 2:** Se o init gerar `src/lib/utils.ts` (helper `cn`), mover pra `src/shared/utils/cn.ts` e ajustar import (`@/lib/utils` → `@/shared/utils/cn`) em `components.json` (`aliases.utils`).
- [ ] **Step 3:** Adicionar componentes usados na Etapa 1 (form de login):
  ```bash
  npx shadcn@latest add button input label form card sonner
  ```
- [ ] **Step 4:** Verificar
  ```bash
  npm run build
  ```
  Expected: passa.
- [ ] **Step 5: Commit**
  ```bash
  git add components.json src/components/ui src/shared/utils/cn.ts src/app/globals.css
  git commit -m "feat: init shadcn/ui"
  ```

---

### Task 4: Firebase client SDK via env vars

**Files:**
- Create: `.env.local` (não commitado — já no `.gitignore`)
- Create: `.env.local.example`
- Delete: `src/shared/services/firebase.ts`
- Create: `src/shared/services/firebase-client.ts`

**Interfaces:**
- Produces: `firebaseApp`, `auth` (from `firebase/auth`), `firestore` (from `firebase/firestore`), `storage` (from `firebase/storage`) — usados por `modules/auth/services` (Task 6) e módulos futuros.

- [ ] **Step 1:** Criar `.env.local` com os valores já hardcoded no arquivo antigo:
  ```
  NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyA2nM7LOtGTM7iV4muPT4faUIAe0ehbwsY
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=printz-1558b.firebaseapp.com
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=printz-1558b
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=printz-1558b.firebasestorage.app
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=984862738538
  NEXT_PUBLIC_FIREBASE_APP_ID=1:984862738538:web:ae901902d3e9ae9319a213
  ```
- [ ] **Step 2:** Criar `.env.local.example` (mesmas chaves, valores vazios) pra documentar setup de outro dev/ambiente:
  ```
  NEXT_PUBLIC_FIREBASE_API_KEY=
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
  NEXT_PUBLIC_FIREBASE_APP_ID=
  ```
- [ ] **Step 3:** Deletar `src/shared/services/firebase.ts`, criar `src/shared/services/firebase-client.ts`:
  ```typescript
  import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
  import { getAuth } from "firebase/auth";
  import { getFirestore } from "firebase/firestore";
  import { getStorage } from "firebase/storage";

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const firebaseApp: FirebaseApp =
    getApps()[0] ?? initializeApp(firebaseConfig);

  export const auth = getAuth(firebaseApp);
  export const firestore = getFirestore(firebaseApp);
  export const storage = getStorage(firebaseApp);
  ```
  (Analytics removido de propósito — `getAnalytics` acessa `window`, quebra em SSR do App Router. Reintroduzir depois só via dynamic import client-side, se necessário.)
- [ ] **Step 4:** Verificar
  ```bash
  npm run build
  ```
  Expected: passa (arquivo ainda não importado em lugar nenhum, mas confirma que não quebrou nada).
- [ ] **Step 5: Commit**
  ```bash
  git add src/shared/services/firebase-client.ts .env.local.example
  git rm src/shared/services/firebase.ts
  git commit -m "feat: firebase client SDK via env vars, drop SSR-unsafe analytics"
  ```
  Nota: `.env.local` não entra no commit (gitignored) — confirmar com `git status` antes do commit que ele não aparece.

---

### Task 5: Firebase Admin SDK singleton (server-only)

**Files:**
- Create: `src/shared/services/firebase-admin.ts`
- Modify: `.env.local`, `.env.local.example` (nova var)

**Interfaces:**
- Produces: `getAdminApp()` → `App` (firebase-admin), `getAdminAuth()` → `Auth`, `getAdminFirestore()` → `Firestore`. Consumidos por Server Actions/Cloud Functions nas próximas etapas — nunca importado em componente client (`"use client"`).

- [ ] **Step 1:** Adicionar `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON da service account, gerada no Console Firebase → Configurações do projeto → Contas de serviço → Gerar nova chave privada) a `.env.local` — valor real fica só local, nunca commitado. Adicionar a chave vazia em `.env.local.example`.
- [ ] **Step 2:** Criar `src/shared/services/firebase-admin.ts`:
  ```typescript
  import "server-only";
  import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
  import { getAuth, type Auth } from "firebase-admin/auth";
  import { getFirestore, type Firestore } from "firebase-admin/firestore";

  function getAdminApp(): App {
    const existing = getApps()[0];
    if (existing) return existing;

    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY não configurada");
    }

    return initializeApp({
      credential: cert(JSON.parse(serviceAccountKey)),
    });
  }

  export function getAdminAuth(): Auth {
    return getAuth(getAdminApp());
  }

  export function getAdminFirestore(): Firestore {
    return getFirestore(getAdminApp());
  }
  ```
  (`import "server-only"` garante erro de build se algum client component importar isso por engano — pacote `server-only` já vem com Next.js.)
- [ ] **Step 3:** Verificar
  ```bash
  npm run build
  ```
  Expected: passa (arquivo ainda não importado).
- [ ] **Step 4: Commit**
  ```bash
  git add src/shared/services/firebase-admin.ts .env.local.example
  git commit -m "feat: firebase admin SDK singleton, guarded with server-only"
  ```

---

### Task 6: Auth service (client) — email/senha + Google

**Files:**
- Create: `src/modules/auth/services/auth.service.ts`
- Create: `src/modules/auth/services/auth.schema.ts`

**Interfaces:**
- Consumes: `auth` de `src/shared/services/firebase-client.ts` (Task 4).
- Produces: `signInWithEmail(email, password): Promise<User>`, `signInWithGoogle(): Promise<User>`, `signOutUser(): Promise<void>`, `loginSchema` (Zod), `LoginInput` (type) — consumidos pelo `useAuth` hook (Task 7) e `LoginForm` (Task 8).

- [ ] **Step 1:** Criar `src/modules/auth/services/auth.schema.ts`:
  ```typescript
  import { z } from "zod";

  export const loginSchema = z.object({
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "Senha precisa ter no mínimo 6 caracteres"),
  });

  export type LoginInput = z.infer<typeof loginSchema>;
  ```
- [ ] **Step 2:** Criar `src/modules/auth/services/auth.service.ts`:
  ```typescript
  import {
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    type User,
  } from "firebase/auth";
  import { auth } from "@/shared/services/firebase-client";

  export async function signInWithEmail(email: string, password: string): Promise<User> {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  }

  export async function signInWithGoogle(): Promise<User> {
    const credential = await signInWithPopup(auth, new GoogleAuthProvider());
    return credential.user;
  }

  export async function signOutUser(): Promise<void> {
    await signOut(auth);
  }
  ```
- [ ] **Step 3:** Verificar
  ```bash
  npm run build
  ```
  Expected: passa.
- [ ] **Step 4: Commit**
  ```bash
  git add src/modules/auth/services
  git commit -m "feat: auth service (email/senha + Google) and login schema"
  ```

---

### Task 7: `useAuth` hook (TanStack Query + `onAuthStateChanged`)

**Files:**
- Create: `src/shared/components/providers/query-provider.tsx`
- Modify: `src/app/layout.tsx`
- Create: `src/shared/hooks/use-auth.ts`

**Interfaces:**
- Consumes: `auth` de `firebase-client.ts` (Task 4).
- Produces: `useAuth(): { user: User | null | undefined, isLoading: boolean }` — consumido pelo `LoginForm`/futuras rotas protegidas.

- [ ] **Step 1:** Criar `src/shared/components/providers/query-provider.tsx`:
  ```typescript
  "use client";

  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { useState } from "react";

  export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  ```
- [ ] **Step 2:** Editar `src/app/layout.tsx` — envolver `children` com `QueryProvider` e adicionar `Toaster` do shadcn:
  ```typescript
  import type { Metadata } from "next";
  import { Geist, Geist_Mono } from "next/font/google";
  import "./globals.css";
  import { QueryProvider } from "@/shared/components/providers/query-provider";
  import { Toaster } from "@/components/ui/sonner";

  const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
  });

  const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
  });

  export const metadata: Metadata = {
    title: "Printz",
    description: "Custo e produção pra impressão 3D",
  };

  export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
      <html
        lang="pt-BR"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <QueryProvider>
            {children}
            <Toaster />
          </QueryProvider>
        </body>
      </html>
    );
  }
  ```
- [ ] **Step 3:** Criar `src/shared/hooks/use-auth.ts`:
  ```typescript
  "use client";

  import { onAuthStateChanged, type User } from "firebase/auth";
  import { useQuery, useQueryClient } from "@tanstack/react-query";
  import { useEffect } from "react";
  import { auth } from "@/shared/services/firebase-client";

  const AUTH_QUERY_KEY = ["auth", "current-user"] as const;

  export function useAuth() {
    const queryClient = useQueryClient();

    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        queryClient.setQueryData<User | null>(AUTH_QUERY_KEY, user);
      });
      return unsubscribe;
    }, [queryClient]);

    const { data, isLoading } = useQuery<User | null>({
      queryKey: AUTH_QUERY_KEY,
      queryFn: () => auth.currentUser,
      initialData: auth.currentUser,
      staleTime: Infinity,
    });

    return { user: data, isLoading };
  }
  ```
- [ ] **Step 4:** Verificar
  ```bash
  npm run build
  ```
  Expected: passa.
- [ ] **Step 5: Commit**
  ```bash
  git add src/shared/components/providers/query-provider.tsx src/app/layout.tsx src/shared/hooks/use-auth.ts
  git commit -m "feat: QueryProvider + useAuth hook synced via onAuthStateChanged"
  ```

---

### Task 8: `LoginForm` + página de login

**Files:**
- Create: `src/modules/auth/components/login-form.tsx`
- Create: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/page.tsx` (placeholder simples — dashboard real é Etapa 2+)

**Interfaces:**
- Consumes: `loginSchema`, `LoginInput`, `signInWithEmail`, `signInWithGoogle` (Task 6); `Button`, `Input`, `Label`, `Form*` de `@/components/ui/*` (Task 3).

- [ ] **Step 1:** Criar `src/modules/auth/components/login-form.tsx`:
  ```typescript
  "use client";

  import { zodResolver } from "@hookform/resolvers/zod";
  import { useRouter } from "next/navigation";
  import { useForm } from "react-hook-form";
  import { toast } from "sonner";
  import { Button } from "@/components/ui/button";
  import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
  } from "@/components/ui/form";
  import { Input } from "@/components/ui/input";
  import { signInWithEmail, signInWithGoogle } from "@/modules/auth/services/auth.service";
  import { loginSchema, type LoginInput } from "@/modules/auth/services/auth.schema";

  export function LoginForm() {
    const router = useRouter();
    const form = useForm<LoginInput>({
      resolver: zodResolver(loginSchema),
      defaultValues: { email: "", password: "" },
    });

    async function onSubmit(values: LoginInput) {
      try {
        await signInWithEmail(values.email, values.password);
        router.push("/");
      } catch {
        toast.error("E-mail ou senha inválidos");
      }
    }

    async function onGoogleSignIn() {
      try {
        await signInWithGoogle();
        router.push("/");
      } catch {
        toast.error("Não foi possível entrar com Google");
      }
    }

    return (
      <div className="flex flex-col gap-4 w-full max-w-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Entrar
            </Button>
          </form>
        </Form>
        <Button variant="outline" onClick={onGoogleSignIn}>
          Entrar com Google
        </Button>
      </div>
    );
  }
  ```
- [ ] **Step 2:** Criar `src/app/(auth)/login/page.tsx`:
  ```typescript
  import { LoginForm } from "@/modules/auth/components/login-form";

  export default function LoginPage() {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <LoginForm />
      </main>
    );
  }
  ```
- [ ] **Step 3:** Substituir `src/app/page.tsx` por placeholder mínimo (dashboard real entra na Etapa 2):
  ```typescript
  export default function HomePage() {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p>Printz — em construção.</p>
      </main>
    );
  }
  ```
- [ ] **Step 4:** Verificar build e rodar dev server
  ```bash
  npm run build
  npm run dev
  ```
  Abrir `http://localhost:3000/login` no navegador — confirmar que form renderiza, campos validam (submit vazio mostra erros Zod), botão Google dispara popup (vai falhar sem provedor Google habilitado no Console — ok pra esta etapa, só confirmar que a chamada dispara).
- [ ] **Step 5: Commit**
  ```bash
  git add src/modules/auth/components/login-form.tsx "src/app/(auth)/login/page.tsx" src/app/page.tsx
  git commit -m "feat: login page with email/senha and Google sign-in"
  ```

---

### Task 9: Verificação final da Etapa 1

- [ ] **Step 1:** Lint completo
  ```bash
  npm run lint
  ```
  Expected: 0 erros (warnings ok, mas revisar).
- [ ] **Step 2:** Build completo
  ```bash
  npm run build
  ```
  Expected: passa sem erro de tipo.
- [ ] **Step 3:** Conferir estrutura de pastas bate com CLAUDE.md §10:
  ```bash
  find src -type d | sort
  ```
  Expected: existe `src/app`, `src/modules/auth/{components,services}`, `src/shared/{components/providers,hooks,services,utils}`, `src/components/ui`.
- [ ] **Step 4:** `git status` — confirmar `.env.local` (com secrets reais) NÃO aparece staged/tracked.
- [ ] **Step 5:** Teste manual no browser: login com e-mail/senha de um usuário real do projeto `printz-1558b` (criar um via Console Firebase Auth se não existir nenhum) — confirmar redirect pra `/` após sucesso, toast de erro em credencial errada.

---

## Verificação end-to-end da Etapa 1

1. `npm run lint && npm run build` — ambos verdes.
2. `npm run dev`, abrir `/login`, testar: submit vazio (erros Zod aparecem), credencial errada (toast erro), credencial certa (redireciona pra `/`).
3. Confirmar no Firebase Console (Authentication) que o usuário logado aparece como ativo/último login atualizado.
4. `git log --oneline -9` mostra os 9 commits desta etapa, nenhum com `.env.local` incluso.
