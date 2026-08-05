"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
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
import { type SignupInput, signupSchema } from "@/modules/auth/services/auth.schema";
import { signInWithGoogle, signUpWithEmail } from "@/modules/auth/services/auth.service";
import { provisionAccount } from "@/modules/auth/services/provision-account.action";
import { auth } from "@/shared/services/firebase-client";

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
