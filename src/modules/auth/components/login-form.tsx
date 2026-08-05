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
import { type LoginInput, loginSchema } from "@/modules/auth/services/auth.schema";
import { signInWithEmail, signInWithGoogle } from "@/modules/auth/services/auth.service";

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
