"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { ApiError, register } from "@/lib/api";
import { setSession } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

const inputClasses =
  "h-12 w-full rounded-xl border border-forest/15 bg-cream px-4 text-forest placeholder:text-moss/40 transition-shadow duration-300 focus:border-forest focus:outline-none focus:ring-4 focus:ring-forest/15";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (name.trim().length === 0) {
      setError("Informe seu nome completo.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("Informe um e-mail válido.");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }
    if (!acceptTerms) {
      setError("Aceite os termos de uso para criar a conta.");
      return;
    }

    setError(null);
    setPending(true);

    try {
      const tokens = await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      setSession(tokens, true);
      router.push("/painel");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível criar a conta. Tente novamente.",
      );
    } finally {
      setPending(false);
    }
  }

  const linkClasses =
    "font-medium text-forest underline underline-offset-4 transition-colors hover:text-moss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist";

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
          htmlFor="name"
          className="mb-1.5 block text-sm font-medium text-forest"
        >
          Nome completo
        </label>
        <input
          id="name"
          type="text"
          name="name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError(null);
          }}
          placeholder="Seu nome"
          autoComplete="name"
          required
          className={inputClasses}
        />
      </div>

      <div className="mt-5">
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
        autoComplete="new-password"
        hint="Mínimo de 8 caracteres."
        className="mt-5"
      />

      <PasswordInput
        id="confirm-password"
        label="Confirmar senha"
        value={confirmPassword}
        onChange={(value) => {
          setConfirmPassword(value);
          if (error) setError(null);
        }}
        autoComplete="new-password"
        className="mt-5"
      />

      <label className="mt-6 flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed text-moss">
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(event) => {
            setAcceptTerms(event.target.checked);
            if (error) setError(null);
          }}
          className="mt-0.5 h-4 w-4 rounded accent-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50"
        />
        <span>
          Li e aceito os{" "}
          <Link href="/terms" className={linkClasses}>
            termos de uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacy" className={linkClasses}>
            política de privacidade
          </Link>
          .
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="group mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-forest text-sm font-medium text-cream transition-all duration-300 hover:bg-forest/90 hover:shadow-lg hover:shadow-forest/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-mist disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Criando conta...
          </>
        ) : (
          <>
            Criar conta gratuita
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </>
        )}
      </button>

      <p className="mt-7 text-center text-sm text-moss">
        Já tem conta?{" "}
        <Link
          href="/auth/login"
          className="font-medium text-forest underline underline-offset-4 transition-colors hover:text-moss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}
