"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
  labelHint?: ReactNode;
  className?: string;
}

const inputClasses =
  "h-12 w-full rounded-xl border border-forest/15 bg-cream px-4 text-forest placeholder:text-moss/40 transition-shadow duration-300 focus:border-forest focus:outline-none focus:ring-4 focus:ring-forest/15";

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  hint,
  labelHint,
  className,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-forest">
          {label}
        </label>
        {labelHint}
      </div>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          name={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder ?? "••••••••••"}
          autoComplete={autoComplete}
          required
          className={`${inputClasses} pr-12`}
        />
        <button
          type="button"
          onClick={() => setShow((visible) => !visible)}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={show}
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-moss transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50"
        >
          {show ? (
            <EyeOff className="h-4.5 w-4.5" aria-hidden="true" />
          ) : (
            <Eye className="h-4.5 w-4.5" aria-hidden="true" />
          )}
        </button>
      </div>
      {hint ? (
        <p className="mt-1.5 text-xs text-moss/70">{hint}</p>
      ) : null}
    </div>
  );
}
