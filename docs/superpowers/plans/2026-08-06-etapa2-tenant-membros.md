# Printz — Etapa 2: Auth + Criação de Tenant + Convite de Membro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Todo signup organico cria um tenant novo (o usuário vira `admin`); admins convidam membros por e-mail (Resend); rotas do dashboard ficam protegidas por claim de tenant/role; Firestore Security Rules garantem isolamento entre tenants desde o primeiro dado real gravado.

**Architecture:** Sem Cloud Functions nesta etapa — decisão explícita do usuário (ver Contexto). A criação de tenant e o consumo de convite rodam em **Server Actions** que verificam o ID token do Firebase (via Admin SDK `verifyIdToken`) antes de qualquer escrita privilegiada — mesmo padrão de "Server Actions pra tudo que usa Admin SDK" já estabelecido na Etapa 1. Isso elimina a corrida de condição entre "signup orgânico cria tenant" x "signup via convite deveria entrar num tenant existente" sem precisar de Identity Platform/blocking functions.

**Tech Stack:** Next.js Server Actions + Firebase Admin SDK (custom claims) + Firestore Security Rules + Resend (e-mail transacional) + Vitest + `@firebase/rules-unit-testing` (primeiro test runner do projeto).

## Contexto

CLAUDE.md §7 lista `onUserSignup` como Cloud Function. Ao planejar, identifiquei que uma Cloud Function assíncrona (`onCreate` trigger) cria uma corrida de condição real: se o usuário está entrando via link de convite, o trigger dispara do mesmo jeito e criaria um tenant órfão antes de qualquer lógica de convite rodar. As duas saídas eram (a) uma Cloud Function *blocking* (`beforeUserCreated`), que resolve a corrida mas exige habilitar Identity Platform no Firebase Console (passo humano extra, API menos comum), ou (b) mover a lógica pra uma Server Action síncrona chamada pelo client logo após o signup, sem depender de nenhum trigger assíncrono. O usuário escolheu (b). Isso significa: nenhuma pasta `functions/` nesta etapa — pode ser revisitada numa etapa futura se algo realmente precisar rodar fora do ciclo de request (ex: `onOrderWrite` pra espelhar pedido de parceiro, etapa 7).

## Global Constraints

- Nunca confiar em `tenantId` vindo do client — toda Server Action que grava em `tenants/{tenantId}/**` deriva o `tenantId` do custom claim do ID token verificado, nunca de um campo de formulário.
- Schema (coleções, campos, funções) em inglês; texto de UI em português.
- Server Actions pra tudo que usa Firebase Admin SDK — Admin SDK nunca no client.
- Client Firebase SDK só pra Auth e leitura em tempo real (`onSnapshot`)/TanStack Query.
- Todo formulário usa RHF + `zodResolver`; schema Zod mora em `modules/{module}/services`.
- UI só shadcn/ui.
- `app/**/page.tsx` só importa e renderiza componente de `modules/{module}/components`.
- Firestore Security Rules: default-deny (`allow read, write: if false` no fallback), acesso liberado só nas regras explícitas desta etapa.

---

## Estado no início desta etapa

- Etapa 1 completa: Biome, deps, shadcn/ui, `firebase-client.ts`/`firebase-admin.ts`, `auth.schema.ts`/`auth.service.ts` (só login), `useAuth` (corrigido no review final — `isLoading` correto), `/login` funcional.
- **Não existe** ainda: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, qualquer framework de teste, rota de signup, dashboard protegido, `useTenant`.
- `FIREBASE_SERVICE_ACCOUNT_KEY` em `.env.local` ainda está vazio (pendência humana da Etapa 1) — **bloqueia toda esta etapa em runtime real**, já que toda Server Action aqui usa Admin SDK. Ver checklist humano no final.

---

## Etapa 2 — Tasks

### Task 1: Bootstrap Firebase config (rules, indexes, sem Cloud Functions)

**Files:**
- Create: `firebase.json`
- Create: `.firebaserc`
- Create: `firestore.rules`
- Create: `firestore.indexes.json`
- Create: `storage.rules`

**Interfaces:** nenhuma (infra). As regras aqui definidas são o contrato de segurança que toda Server Action/rules-test das próximas tasks assume.

- [ ] **Step 1:** Criar `.firebaserc`:
  ```json
  {
    "projects": {
      "default": "printz-1558b"
    }
  }
  ```
- [ ] **Step 2:** Criar `firebase.json`:
  ```json
  {
    "firestore": {
      "rules": "firestore.rules",
      "indexes": "firestore.indexes.json"
    },
    "storage": {
      "rules": "storage.rules"
    }
  }
  ```
- [ ] **Step 3:** Criar `firestore.indexes.json` (vazio por enquanto — próximas etapas adicionam índices compostos conforme §12 do CLAUDE.md):
  ```json
  {
    "indexes": [],
    "fieldOverrides": []
  }
  ```
- [ ] **Step 4:** Criar `storage.rules` (placeholder deny-all — upload de foto/STL é Etapa 4+):
  ```
  rules_version = '2';
  service firebase.storage {
    match /b/{bucket}/o {
      match /{allPaths=**} {
        allow read, write: if false;
      }
    }
  }
  ```
- [ ] **Step 5:** Criar `firestore.rules`:
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      function isSignedIn() {
        return request.auth != null;
      }
      function claimTenantId() {
        return request.auth.token.tenantId;
      }
      function claimRole() {
        return request.auth.token.role;
      }
      function isMember(tenantId) {
        return isSignedIn() && claimTenantId() == tenantId;
      }
      function isAdmin(tenantId) {
        return isMember(tenantId) && claimRole() == 'admin';
      }

      match /tenants/{tenantId} {
        allow read: if isMember(tenantId);
        allow write: if isAdmin(tenantId);

        match /members/{memberId} {
          allow read: if isMember(tenantId);
          allow write: if isAdmin(tenantId);
        }

        match /settings/{settingsDoc} {
          allow read: if isMember(tenantId);
          allow write: if isAdmin(tenantId);
        }
      }

      // Só Server Actions (Admin SDK) tocam pendingInvites — nunca o client.
      match /pendingInvites/{inviteId} {
        allow read, write: if false;
      }

      match /{document=**} {
        allow read, write: if false;
      }
    }
  }
  ```
- [ ] **Step 6:** Verificar sintaxe das regras sem precisar de projeto real:
  ```bash
  firebase --version
  ```
  Expected: CLI presente (já confirmado `15.25.1`). A validação de sintaxe de verdade acontece via emulador na Task 9 — aqui só confirmamos que os arquivos existem e são JSON/rules válidos sintaticamente (`cat firestore.rules` sem erro de leitura, `node -e "JSON.parse(require('fs').readFileSync('firebase.json'))"` não lança).
- [ ] **Step 7: Commit**
  ```bash
  git add firebase.json .firebaserc firestore.rules firestore.indexes.json storage.rules
  git commit -m "chore: bootstrap firebase.json, firestore rules, storage rules"
  ```

---

### Task 2: Signup schema + service (estende auth module)

**Files:**
- Modify: `src/modules/auth/services/auth.schema.ts`
- Modify: `src/modules/auth/services/auth.service.ts`

**Interfaces:**
- Consumes: `auth` de `src/shared/services/firebase-client.ts`.
- Produces: `signupSchema`, `SignupInput` (Zod), `signUpWithEmail(email, password, displayName): Promise<User>` — consumidos pelo `SignupForm` (Task 4).

- [ ] **Step 1:** Adicionar a `src/modules/auth/services/auth.schema.ts` (mantendo `loginSchema`/`LoginInput` existentes):
  ```typescript
  export const signupSchema = z.object({
    displayName: z.string().min(2, "Nome precisa ter no mínimo 2 caracteres"),
    email: z.email("E-mail inválido"),
    password: z.string().min(6, "Senha precisa ter no mínimo 6 caracteres"),
  });

  export type SignupInput = z.infer<typeof signupSchema>;
  ```
- [ ] **Step 2:** Adicionar a `src/modules/auth/services/auth.service.ts` (mantendo as funções existentes):
  ```typescript
  import {
    createUserWithEmailAndPassword,
    updateProfile,
  } from "firebase/auth";

  export async function signUpWithEmail(
    email: string,
    password: string,
    displayName: string,
  ): Promise<User> {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName });
    return credential.user;
  }
  ```
  (Adicionar `createUserWithEmailAndPassword` e `updateProfile` ao import existente de `"firebase/auth"` no topo do arquivo, junto dos já importados `GoogleAuthProvider`, `signInWithEmailAndPassword`, etc.)
- [ ] **Step 3:** Verificar
  ```bash
  npm run build
  ```
  Expected: passa.
- [ ] **Step 4: Commit**
  ```bash
  git add src/modules/auth/services/auth.schema.ts src/modules/auth/services/auth.service.ts
  git commit -m "feat: signup schema and signUpWithEmail service"
  ```

---

### Task 3: `provisionAccount` Server Action (cria tenant OU consome convite)

**Files:**
- Create: `src/modules/auth/services/provision-account.action.ts`
- Create: `src/shared/types/tenant.ts`

**Interfaces:**
- Consumes: `getAdminAuth()`, `getAdminFirestore()` de `src/shared/services/firebase-admin.ts` (Etapa 1, Task 5).
- Produces: `provisionAccount(input: { idToken: string; inviteToken?: string }): Promise<{ tenantId: string; role: "admin" | "member" }>` — chamada pelo `SignupForm` (Task 4) logo após criar o usuário no Firebase Auth. Tipos `Tenant`, `Member` em `shared/types/tenant.ts` — reaproveitados por `useTenant` (Task 5) e pela UI de time (Task 8).

- [ ] **Step 1:** Criar `src/shared/types/tenant.ts`:
  ```typescript
  export type MemberRole = "admin" | "member";

  export interface Tenant {
    name: string;
    plan: string;
    createdAt: number;
    ownerId: string;
  }

  export interface Member {
    email: string;
    displayName: string;
    role: MemberRole;
  }

  export interface PendingInvite {
    email: string;
    tenantId: string;
    role: MemberRole;
    createdAt: number;
  }
  ```
- [ ] **Step 2:** Criar `src/modules/auth/services/provision-account.action.ts`:
  ```typescript
  "use server";

  import { getAdminAuth, getAdminFirestore } from "@/shared/services/firebase-admin";
  import type { Member, PendingInvite, Tenant } from "@/shared/types/tenant";

  interface ProvisionAccountInput {
    idToken: string;
    inviteToken?: string;
  }

  interface ProvisionAccountResult {
    tenantId: string;
    role: "admin" | "member";
  }

  export async function provisionAccount(
    input: ProvisionAccountInput,
  ): Promise<ProvisionAccountResult> {
    const decoded = await getAdminAuth().verifyIdToken(input.idToken);
    const { uid, email } = decoded;

    if (!email) {
      throw new Error("Token não contém e-mail");
    }

    const firestore = getAdminFirestore();

    if (input.inviteToken) {
      const inviteRef = firestore.collection("pendingInvites").doc(input.inviteToken);
      const inviteSnap = await inviteRef.get();

      if (!inviteSnap.exists) {
        throw new Error("Convite inválido ou expirado");
      }

      const invite = inviteSnap.data() as PendingInvite;

      if (invite.email.toLowerCase() !== email.toLowerCase()) {
        throw new Error("E-mail não corresponde ao convite");
      }

      const member: Member = {
        email,
        displayName: decoded.name ?? email,
        role: invite.role,
      };

      await firestore
        .collection("tenants")
        .doc(invite.tenantId)
        .collection("members")
        .doc(uid)
        .set(member);

      await getAdminAuth().setCustomUserClaims(uid, {
        tenantId: invite.tenantId,
        role: invite.role,
      });

      await inviteRef.delete();

      return { tenantId: invite.tenantId, role: invite.role };
    }

    const tenantRef = firestore.collection("tenants").doc();
    const tenant: Tenant = {
      name: `Tenant de ${decoded.name ?? email}`,
      plan: "free",
      createdAt: Date.now(),
      ownerId: uid,
    };
    await tenantRef.set(tenant);

    const member: Member = {
      email,
      displayName: decoded.name ?? email,
      role: "admin",
    };
    await tenantRef.collection("members").doc(uid).set(member);

    await getAdminAuth().setCustomUserClaims(uid, {
      tenantId: tenantRef.id,
      role: "admin",
    });

    return { tenantId: tenantRef.id, role: "admin" };
  }
  ```
- [ ] **Step 3:** Verificar
  ```bash
  npm run build
  ```
  Expected: passa (Server Action ainda não é chamada de lugar nenhum, mas deve compilar).
- [ ] **Step 4: Commit**
  ```bash
  git add src/modules/auth/services/provision-account.action.ts src/shared/types/tenant.ts
  git commit -m "feat: provisionAccount server action — creates tenant or consumes invite"
  ```

---

### Task 4: `SignupForm` + página de signup

**Files:**
- Create: `src/modules/auth/components/signup-form.tsx`
- Create: `src/app/(auth)/signup/page.tsx`

**Interfaces:**
- Consumes: `signupSchema`, `SignupInput`, `signUpWithEmail`, `signInWithGoogle` (Task 2/Etapa 1), `provisionAccount` (Task 3), `Form*`/`Button`/`Input` de `@/components/ui/*`.

- [ ] **Step 1:** Criar `src/modules/auth/components/signup-form.tsx`:
  ```typescript
  "use client";

  import { zodResolver } from "@hookform/resolvers/zod";
  import { useSearchParams, useRouter } from "next/navigation";
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
  import { signInWithGoogle, signUpWithEmail } from "@/modules/auth/services/auth.service";
  import { signupSchema, type SignupInput } from "@/modules/auth/services/auth.schema";
  import { provisionAccount } from "@/modules/auth/services/provision-account.action";

  export function SignupForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const inviteToken = searchParams.get("invite") ?? undefined;

    const form = useForm<SignupInput>({
      resolver: zodResolver(signupSchema),
      defaultValues: { displayName: "", email: "", password: "" },
    });

    async function provisionAndRedirect(idToken: string) {
      await provisionAccount({ idToken, inviteToken });
      const { auth } = await import("@/shared/services/firebase-client");
      await auth.currentUser?.getIdToken(true);
      router.push("/");
    }

    async function onSubmit(values: SignupInput) {
      try {
        const user = await signUpWithEmail(values.email, values.password, values.displayName);
        const idToken = await user.getIdToken();
        await provisionAndRedirect(idToken);
      } catch {
        toast.error("Não foi possível criar sua conta");
      }
    }

    async function onGoogleSignUp() {
      try {
        const user = await signInWithGoogle();
        const idToken = await user.getIdToken();
        await provisionAndRedirect(idToken);
      } catch {
        toast.error("Não foi possível criar sua conta com Google");
      }
    }

    return (
      <div className="flex flex-col gap-4 w-full max-w-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Criar conta
            </Button>
          </form>
        </Form>
        <Button variant="outline" onClick={onGoogleSignUp}>
          Criar conta com Google
        </Button>
      </div>
    );
  }
  ```
  Nota: o dynamic `import("@/shared/services/firebase-client")` dentro de `provisionAndRedirect` é só pra evitar duplicar o import de `auth` — se preferir, importe `auth` estaticamente no topo do arquivo junto dos outros imports (mais simples, mesmo efeito). Ambas as formas são aceitáveis; use a estática se achar mais limpa.
- [ ] **Step 2:** Criar `src/app/(auth)/signup/page.tsx`:
  ```typescript
  import { SignupForm } from "@/modules/auth/components/signup-form";

  export default function SignupPage() {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <SignupForm />
      </main>
    );
  }
  ```
- [ ] **Step 3:** Verificar
  ```bash
  npm run build
  ```
  Expected: passa. `useSearchParams` em Server Component pai exige que a página seja renderizada dentro de `<Suspense>` no App Router quando pré-renderizada estaticamente — se o build reclamar disso, envolva `<SignupForm />` em `<Suspense fallback={null}>` dentro de `signup/page.tsx`.
- [ ] **Step 4: Commit**
  ```bash
  git add src/modules/auth/components/signup-form.tsx "src/app/(auth)/signup/page.tsx"
  git commit -m "feat: signup page — email/senha, Google, and invite-aware provisioning"
  ```

---

### Task 5: `useTenant` hook (lê claims do ID token)

**Files:**
- Create: `src/shared/hooks/use-tenant.ts`

**Interfaces:**
- Consumes: `useAuth()` (Etapa 1, Task 7) pro `user` atual.
- Produces: `useTenant(): { tenantId: string | undefined; role: "admin" | "member" | undefined; isLoading: boolean }` — consumido pelo dashboard layout (Task 6) e pela UI de time (Task 8).

- [ ] **Step 1:** Criar `src/shared/hooks/use-tenant.ts`:
  ```typescript
  "use client";

  import { useQuery } from "@tanstack/react-query";
  import { useAuth } from "@/shared/hooks/use-auth";

  interface TenantClaims {
    tenantId: string | undefined;
    role: "admin" | "member" | undefined;
  }

  export function useTenant() {
    const { user, isLoading: isAuthLoading } = useAuth();

    const { data, isLoading: isClaimsLoading } = useQuery<TenantClaims>({
      queryKey: ["auth", "tenant-claims", user?.uid],
      queryFn: async () => {
        if (!user) return { tenantId: undefined, role: undefined };
        const result = await user.getIdTokenResult();
        return {
          tenantId: result.claims.tenantId as string | undefined,
          role: result.claims.role as "admin" | "member" | undefined,
        };
      },
      enabled: !isAuthLoading,
      staleTime: 5 * 60 * 1000,
    });

    return {
      tenantId: data?.tenantId,
      role: data?.role,
      isLoading: isAuthLoading || isClaimsLoading,
    };
  }
  ```
- [ ] **Step 2:** Verificar
  ```bash
  npm run build
  ```
  Expected: passa.
- [ ] **Step 3: Commit**
  ```bash
  git add src/shared/hooks/use-tenant.ts
  git commit -m "feat: useTenant hook reads tenantId/role from ID token claims"
  ```

---

### Task 6: Dashboard layout protegido

**Files:**
- Create: `src/shared/components/dashboard-shell.tsx`
- Create: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `useTenant()`, `signOutUser()`.

- [ ] **Step 1:** Criar `src/shared/components/dashboard-shell.tsx`:
  ```typescript
  "use client";

  import { useRouter } from "next/navigation";
  import { useEffect } from "react";
  import { Button } from "@/components/ui/button";
  import { signOutUser } from "@/modules/auth/services/auth.service";
  import { useAuth } from "@/shared/hooks/use-auth";
  import { useTenant } from "@/shared/hooks/use-tenant";

  export function DashboardShell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { user, isLoading: isAuthLoading } = useAuth();
    const { tenantId, isLoading: isTenantLoading } = useTenant();

    useEffect(() => {
      if (!isAuthLoading && !user) {
        router.replace("/login");
      }
    }, [isAuthLoading, user, router]);

    if (isAuthLoading || isTenantLoading || !user) {
      return (
        <div className="flex flex-1 items-center justify-center p-6">
          <p>Carregando...</p>
        </div>
      );
    }

    if (!tenantId) {
      return (
        <div className="flex flex-1 items-center justify-center p-6">
          <p>Sua conta ainda não está associada a um tenant. Entre em contato com o suporte.</p>
        </div>
      );
    }

    async function handleSignOut() {
      await signOutUser();
      router.push("/login");
    }

    return (
      <div className="flex min-h-full flex-col">
        <header className="flex items-center justify-between border-b p-4">
          <span className="font-semibold">Printz</span>
          <Button variant="outline" onClick={handleSignOut}>
            Sair
          </Button>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    );
  }
  ```
- [ ] **Step 2:** Criar `src/app/(dashboard)/layout.tsx`:
  ```typescript
  import { DashboardShell } from "@/shared/components/dashboard-shell";

  export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return <DashboardShell>{children}</DashboardShell>;
  }
  ```
- [ ] **Step 3:** Mover o placeholder atual de `src/app/page.tsx` pra dentro do grupo `(dashboard)` — como `/` precisa continuar sendo a home, crie `src/app/(dashboard)/page.tsx` com o conteúdo (substituindo o antigo `src/app/page.tsx` de Etapa 1):
  ```typescript
  export default function DashboardHomePage() {
    return <p>Printz — em construção.</p>;
  }
  ```
  Delete `src/app/page.tsx` (o antigo placeholder da raiz) — a rota `/` agora é servida por `src/app/(dashboard)/page.tsx`, protegida pelo layout do grupo.
- [ ] **Step 4:** Verificar
  ```bash
  npm run build
  ```
  Expected: passa, rotas geradas incluem `/`, `/login`, `/signup`.
- [ ] **Step 5: Commit**
  ```bash
  git add src/shared/components/dashboard-shell.tsx "src/app/(dashboard)/layout.tsx" "src/app/(dashboard)/page.tsx"
  git rm src/app/page.tsx
  git commit -m "feat: protected dashboard layout with auth/tenant guard"
  ```

---

### Task 7: Resend + `inviteMember` Server Action

**Files:**
- Create: `src/shared/services/email.ts`
- Create: `src/modules/team/services/invite-member.action.ts`
- Create: `src/modules/team/services/team.schema.ts`
- Modify: `.env.local`, `.env.local.example`

**Interfaces:**
- Produces: `sendEmail({ to, subject, html }): Promise<void>` (shared/services/email.ts); `inviteMemberSchema`, `InviteMemberInput` (team.schema.ts); `inviteMember(input: { idToken: string; email: string; role: MemberRole }): Promise<void>` (invite-member.action.ts) — consumido pela UI de time (Task 8).

- [ ] **Step 1:**
  ```bash
  npm install resend
  ```
- [ ] **Step 2:** Adicionar `RESEND_API_KEY=` (vazio — chave real é passo humano) a `.env.local` e `.env.local.example`. Adicionar também `NEXT_PUBLIC_APP_URL=http://localhost:3000` (usada pro link do convite) a ambos os arquivos.
- [ ] **Step 3:** Criar `src/shared/services/email.ts`:
  ```typescript
  import "server-only";
  import { Resend } from "resend";

  interface SendEmailInput {
    to: string;
    subject: string;
    html: string;
  }

  function getResendClient(): Resend {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY não configurada");
    }
    return new Resend(apiKey);
  }

  export async function sendEmail(input: SendEmailInput): Promise<void> {
    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from: "Printz <onboarding@resend.dev>",
      to: input.to,
      subject: input.subject,
      html: input.html,
    });

    if (error) {
      throw new Error(`Falha ao enviar e-mail: ${error.message}`);
    }
  }
  ```
  Nota: `onboarding@resend.dev` é o remetente de teste padrão do Resend (funciona sem verificar domínio próprio) — trocar por um domínio verificado do projeto antes de produção real, mas suficiente pro MVP/dev.
- [ ] **Step 4:** Criar `src/modules/team/services/team.schema.ts`:
  ```typescript
  import { z } from "zod";

  export const inviteMemberSchema = z.object({
    email: z.email("E-mail inválido"),
    role: z.enum(["admin", "member"]),
  });

  export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
  ```
- [ ] **Step 5:** Criar `src/modules/team/services/invite-member.action.ts`:
  ```typescript
  "use server";

  import { randomUUID } from "node:crypto";
  import { sendEmail } from "@/shared/services/email";
  import { getAdminAuth, getAdminFirestore } from "@/shared/services/firebase-admin";
  import type { PendingInvite } from "@/shared/types/tenant";

  interface InviteMemberActionInput {
    idToken: string;
    email: string;
    role: "admin" | "member";
  }

  export async function inviteMember(input: InviteMemberActionInput): Promise<void> {
    const decoded = await getAdminAuth().verifyIdToken(input.idToken);
    const tenantId = decoded.tenantId as string | undefined;
    const role = decoded.role as string | undefined;

    if (!tenantId || role !== "admin") {
      throw new Error("Apenas administradores podem convidar membros");
    }

    const token = randomUUID();
    const invite: PendingInvite = {
      email: input.email,
      tenantId,
      role: input.role,
      createdAt: Date.now(),
    };

    await getAdminFirestore().collection("pendingInvites").doc(token).set(invite);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteUrl = `${appUrl}/signup?invite=${token}`;

    await sendEmail({
      to: input.email,
      subject: "Você foi convidado pra um time no Printz",
      html: `<p>Você foi convidado a entrar num time no Printz.</p><p><a href="${inviteUrl}">Clique aqui pra criar sua conta</a></p>`,
    });
  }
  ```
- [ ] **Step 6:** Verificar
  ```bash
  npm run build
  ```
  Expected: passa.
- [ ] **Step 7: Commit**
  ```bash
  git add package.json package-lock.json src/shared/services/email.ts src/modules/team/services .env.local.example
  git commit -m "feat: resend integration and inviteMember server action"
  ```

---

### Task 8: UI de time (lista de membros + convite)

**Files:**
- Create: `src/modules/team/services/team.service.ts`
- Create: `src/modules/team/components/member-list.tsx`
- Create: `src/modules/team/components/invite-member-form.tsx`
- Create: `src/app/(dashboard)/team/page.tsx`

**Interfaces:**
- Consumes: `inviteMemberSchema`/`InviteMemberInput` (Task 7), `inviteMember` (Task 7), `useAuth()`, `useTenant()`, `Member` type (Task 3).
- Produces: `useMembers(tenantId)` (TanStack Query hook lendo `tenants/{tenantId}/members` via client SDK `onSnapshot`), consumido só por `member-list.tsx`.

- [ ] **Step 1:** Criar `src/modules/team/services/team.service.ts`:
  ```typescript
  "use client";

  import { collection, onSnapshot } from "firebase/firestore";
  import { useQuery, useQueryClient } from "@tanstack/react-query";
  import { useEffect } from "react";
  import { firestore } from "@/shared/services/firebase-client";
  import type { Member } from "@/shared/types/tenant";

  interface MemberWithId extends Member {
    id: string;
  }

  export function useMembers(tenantId: string | undefined) {
    const queryClient = useQueryClient();
    const queryKey = ["team", "members", tenantId] as const;

    useEffect(() => {
      if (!tenantId) return;
      const unsubscribe = onSnapshot(
        collection(firestore, "tenants", tenantId, "members"),
        (snapshot) => {
          const members: MemberWithId[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Member),
          }));
          queryClient.setQueryData(queryKey, members);
        },
      );
      return unsubscribe;
      // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey is derived from tenantId, already a dependency
    }, [tenantId, queryClient]);

    return useQuery<MemberWithId[]>({
      queryKey,
      queryFn: () => [],
      enabled: !!tenantId,
      staleTime: Infinity,
      initialData: [],
    });
  }
  ```
- [ ] **Step 2:** Criar `src/modules/team/components/member-list.tsx`:
  ```typescript
  "use client";

  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";
  import { useMembers } from "@/modules/team/services/team.service";

  export function MemberList({ tenantId }: { tenantId: string }) {
    const { data: members } = useMembers(tenantId);

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Papel</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id}>
              <TableCell>{member.displayName}</TableCell>
              <TableCell>{member.email}</TableCell>
              <TableCell>{member.role === "admin" ? "Administrador" : "Membro"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }
  ```
  Este componente usa `Table` do shadcn — ainda não instalado. Adicione ao `npx shadcn@latest add` desta task: `npx shadcn@latest add table select` (`select` é usado no Step 3 pro campo de papel do formulário de convite).
- [ ] **Step 3:** Criar `src/modules/team/components/invite-member-form.tsx`:
  ```typescript
  "use client";

  import { zodResolver } from "@hookform/resolvers/zod";
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
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
  import { inviteMember } from "@/modules/team/services/invite-member.action";
  import { inviteMemberSchema, type InviteMemberInput } from "@/modules/team/services/team.schema";
  import { auth } from "@/shared/services/firebase-client";

  export function InviteMemberForm() {
    const form = useForm<InviteMemberInput>({
      resolver: zodResolver(inviteMemberSchema),
      defaultValues: { email: "", role: "member" },
    });

    async function onSubmit(values: InviteMemberInput) {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Não autenticado");
        await inviteMember({ idToken, email: values.email, role: values.role });
        toast.success("Convite enviado");
        form.reset();
      } catch {
        toast.error("Não foi possível enviar o convite");
      }
    }

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-end gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Papel</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="member">Membro</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Convidar
          </Button>
        </form>
      </Form>
    );
  }
  ```
- [ ] **Step 4:** Criar `src/app/(dashboard)/team/page.tsx`:
  ```typescript
  "use client";

  import { InviteMemberForm } from "@/modules/team/components/invite-member-form";
  import { MemberList } from "@/modules/team/components/member-list";
  import { useTenant } from "@/shared/hooks/use-tenant";

  export default function TeamPage() {
    const { tenantId } = useTenant();

    if (!tenantId) return null;

    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold">Time</h1>
        <InviteMemberForm />
        <MemberList tenantId={tenantId} />
      </div>
    );
  }
  ```
  Nota: esta página usa `useTenant` diretamente (precisa ser client component), o que quebra a regra geral "`page.tsx` só renderiza componente de módulo" — mas `useTenant` é um hook compartilhado, não lógica de negócio do módulo `team`. Se preferir manter a regra à risca, mova esse `useTenant()` + guarda de `tenantId` pra dentro de um componente `TeamPageContent` em `modules/team/components/` e deixe `page.tsx` só renderizando `<TeamPageContent />`. Ambas as formas são aceitáveis — a implementação escolhe.
- [ ] **Step 5:** Verificar
  ```bash
  npm run build
  ```
  Expected: passa, rota `/team` gerada.
- [ ] **Step 6: Commit**
  ```bash
  git add src/modules/team/services/team.service.ts src/modules/team/components "src/app/(dashboard)/team"
  git commit -m "feat: team page — member list and invite form"
  ```

---

### Task 9: Testes de Firestore Security Rules (primeiro test runner do projeto)

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/firestore-rules/tenant-isolation.test.ts`
- Modify: `package.json` (script `test`)

**Interfaces:** nenhuma de produção — só testes.

- [ ] **Step 1:**
  ```bash
  npm install -D vitest @firebase/rules-unit-testing
  ```
- [ ] **Step 2:** Criar `vitest.config.ts`:
  ```typescript
  import { defineConfig } from "vitest/config";

  export default defineConfig({
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
      testTimeout: 20000,
    },
  });
  ```
- [ ] **Step 3:** Adicionar a `package.json`:
  ```json
  "scripts": {
    "test": "vitest run"
  }
  ```
- [ ] **Step 4:** Criar `tests/firestore-rules/tenant-isolation.test.ts`:
  ```typescript
  import { readFileSync } from "node:fs";
  import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
  } from "@firebase/rules-unit-testing";
  import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "printz-rules-test",
      firestore: {
        rules: readFileSync("firestore.rules", "utf8"),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  describe("tenant isolation", () => {
    it("member can read their own tenant doc", async () => {
      const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("tenants").doc("tenant-a").set({ name: "Tenant A" });
      });

      await assertSucceeds(alice.firestore().collection("tenants").doc("tenant-a").get());
    });

    it("member cannot read a different tenant's doc", async () => {
      const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("tenants").doc("tenant-b").set({ name: "Tenant B" });
      });

      await assertFails(alice.firestore().collection("tenants").doc("tenant-b").get());
    });

    it("unauthenticated user cannot read any tenant doc", async () => {
      const anon = testEnv.unauthenticatedContext();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("tenants").doc("tenant-a").set({ name: "Tenant A" });
      });

      await assertFails(anon.firestore().collection("tenants").doc("tenant-a").get());
    });

    it("member (non-admin) cannot write tenant settings", async () => {
      const bob = testEnv.authenticatedContext("bob", { tenantId: "tenant-a", role: "member" });

      await assertFails(
        bob
          .firestore()
          .collection("tenants")
          .doc("tenant-a")
          .collection("settings")
          .doc("costs")
          .set({ energyRateKwh: 1 }),
      );
    });

    it("admin can write tenant settings", async () => {
      const admin = testEnv.authenticatedContext("admin-uid", { tenantId: "tenant-a", role: "admin" });

      await assertSucceeds(
        admin
          .firestore()
          .collection("tenants")
          .doc("tenant-a")
          .collection("settings")
          .doc("costs")
          .set({ energyRateKwh: 1 }),
      );
    });

    it("no client can read or write pendingInvites", async () => {
      const admin = testEnv.authenticatedContext("admin-uid", { tenantId: "tenant-a", role: "admin" });

      await assertFails(
        admin.firestore().collection("pendingInvites").doc("token-123").get(),
      );
      await assertFails(
        admin
          .firestore()
          .collection("pendingInvites")
          .doc("token-123")
          .set({ email: "x@example.com", tenantId: "tenant-a", role: "member", createdAt: 1 }),
      );
    });
  });
  ```
- [ ] **Step 5:** Rodar os testes contra o emulador do Firestore:
  ```bash
  firebase emulators:exec --only firestore "npm test"
  ```
  Expected: 6/6 passando. Se o emulador não estiver instalado localmente, `firebase emulators:exec` baixa automaticamente na primeira execução — pode levar alguns minutos.
- [ ] **Step 6: Commit**
  ```bash
  git add vitest.config.ts tests package.json package-lock.json
  git commit -m "test: firestore security rules tenant isolation tests"
  ```

---

### Task 10: Verificação final da Etapa 2

- [ ] **Step 1:** Lint + build
  ```bash
  npm run lint
  npm run build
  ```
  Expected: 0 erros de lint (fora as SVGs, se reaparecerem — não devem), build limpo.
- [ ] **Step 2:** Testes de regras
  ```bash
  firebase emulators:exec --only firestore "npm test"
  ```
  Expected: todos passando.
- [ ] **Step 3:** `git status` — confirmar `.env.local` não tracked.
- [ ] **Step 4:** Checklist manual (requer `FIREBASE_SERVICE_ACCOUNT_KEY` e `RESEND_API_KEY` reais — ver checklist humano):
  1. `npm run dev`, abrir `/signup`, criar conta nova → deve redirecionar pra `/` já dentro do dashboard, header mostra "Sair".
  2. Abrir `/team`, convidar um segundo e-mail como "Membro" → checar Resend dashboard/inbox que o e-mail chegou com o link `/signup?invite=...`.
  3. Abrir o link do convite (outro navegador/aba anônima), criar conta com o e-mail convidado → deve entrar no MESMO tenant como `member` (checar `/team` do admin, a nova pessoa aparece na lista).
  4. Confirmar no Firebase Console → Authentication que os custom claims (`tenantId`, `role`) aparecem pro novo usuário (via `firebase auth:export` ou inspecionando o ID token no DevTools).
- [ ] **Step 5:** Deploy das regras pro projeto real (passo humano, requer `firebase login` interativo):
  ```bash
  firebase deploy --only firestore:rules,firestore:indexes,storage
  ```

---

## Checklist humano (bloqueia partes desta etapa)

1. **`FIREBASE_SERVICE_ACCOUNT_KEY`** (pendência já existia desde Etapa 1) — sem isso, `provisionAccount`/`inviteMember` lançam erro em runtime. Gerar em Firebase Console → Configurações do projeto → Contas de serviço.
2. **`RESEND_API_KEY`** — criar conta em resend.com, gerar API key, colar em `.env.local`. Sem isso, `inviteMember` falha ao enviar o e-mail (o convite ainda é gravado em `pendingInvites`, só o e-mail que não sai).
3. **`firebase login`** local — necessário pra `firebase deploy --only firestore:rules` (Task 10, Step 5) e opcionalmente pra rodar os testes de regras contra um emulador autenticado.
4. **Deploy manual das regras** — este plano cria os arquivos de regras, mas não faz deploy automático pro projeto real (ação que afeta acesso a dados em produção — fica pro humano confirmar e rodar).

## Verificação end-to-end da Etapa 2

1. `npm run lint && npm run build && firebase emulators:exec --only firestore "npm test"` — tudo verde.
2. Signup orgânico cria tenant novo + claims `role: admin`.
3. Convite de membro cria e-mail via Resend, aceite do convite entra no MESMO tenant como `member`, nunca cria tenant órfão.
4. Regras de segurança bloqueiam leitura cross-tenant e escrita de não-admin em `settings`, confirmado pelos testes automatizados (Task 9) — não só manualmente.
