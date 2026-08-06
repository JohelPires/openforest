"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { ApiError, login } from "@/lib/api";
import { setSession } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClasses =
  "h-12 w-full rounded-xl border border-forest/15 bg-cream px-4 text-forest placeholder:text-moss/40 transition-shadow duration-300 focus:border-forest focus:outline-none focus:ring-4 focus:ring-forest/15";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!EMAIL_RE.test(email.trim())) {
      setError("Informe um e-mail válido para entrar.");
      return;
    }
    if (password.length === 0) {
      setError("Digite sua senha para entrar.");
      return;
    }

    setError(null);
    setPending(true);

    try {
      const tokens = await login({ email: email.trim(), password });
      setSession(tokens, remember);
      router.push("/painel");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível entrar. Tente novamente.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8">
      {error ? (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-relaxed text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium text-forest"
        >
          E-mail
        </label>
        <input
          id="email"
          type="email"
          name="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError(null);
          }}
          placeholder="voce@organizacao.org"
          autoComplete="email"
          inputMode="email"
          required
          className={inputClasses}
        />
      </div>

      <PasswordInput
        id="password"
        label="Senha"
        value={password}
        onChange={(value) => {
          setPassword(value);
          if (error) setError(null);
        }}
        autoComplete="current-password"
        className="mt-5"
        labelHint={
          <Link
            href="/auth/forgot-password"
            className="text-xs font-medium text-moss transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
          >
            Esqueceu a senha?
          </Link>
        }
      />

      <label className="mt-5 inline-flex cursor-pointer items-center gap-2 text-sm text-moss">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          className="h-4 w-4 rounded accent-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50"
        />
        Lembrar de mim
      </label>

      <button
        type="submit"
        disabled={pending}
        className="group mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-forest text-sm font-medium text-cream transition-all duration-300 hover:bg-forest/90 hover:shadow-lg hover:shadow-forest/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-mist disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Entrando...
          </>
        ) : (
          <>
            Entrar no painel
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </>
        )}
      </button>

      <p className="mt-7 text-center text-sm text-moss">
        Ainda não tem conta?{" "}
        <Link
          href="/auth/register"
          className="font-medium text-forest underline underline-offset-4 transition-colors hover:text-moss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
        >
          Criar conta gratuita
        </Link>
      </p>
    </form>
  );
}
