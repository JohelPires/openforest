"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(false);

    if (!EMAIL_RE.test(email.trim())) {
      setError("Informe um e-mail válido para entrar.");
      return;
    }
    if (password.length === 0) {
      setError("Digite sua senha para entrar.");
      return;
    }

    setError(null);
    setSuccess(true);
  }

  const inputClasses =
    "h-12 w-full rounded-xl border border-forest/15 bg-cream px-4 text-forest placeholder:text-moss/40 transition-shadow duration-300 focus:border-forest focus:outline-none focus:ring-4 focus:ring-forest/15";

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

      {success ? (
        <p className="mb-5 rounded-xl border border-sage bg-sage/30 px-4 py-3 text-sm leading-relaxed text-forest">
          Sessão iniciada. Este é um preview visual — o backend ainda não está
          conectado.
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

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between">
          <label
            htmlFor="password"
            className="text-sm font-medium text-forest"
          >
            Senha
          </label>
          <Link
            href="/auth/forgot-password"
            className="text-xs font-medium text-moss transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
          >
            Esqueceu a senha?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            name="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError(null);
            }}
            placeholder="••••••••••"
            autoComplete="current-password"
            required
            className={`${inputClasses} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={showPassword}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-moss transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50"
          >
            {showPassword ? (
              <EyeOff className="h-4.5 w-4.5" aria-hidden="true" />
            ) : (
              <Eye className="h-4.5 w-4.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-moss">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="h-4 w-4 rounded accent-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50"
          />
          Lembrar de mim
        </label>
      </div>

      <button
        type="submit"
        className="group mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-forest text-sm font-medium text-cream transition-all duration-300 hover:bg-forest/90 hover:shadow-lg hover:shadow-forest/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
      >
        Entrar no painel
        <ArrowRight
          className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
          aria-hidden="true"
        />
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
