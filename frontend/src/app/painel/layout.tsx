import type { ReactNode } from "react";
import { PainelShell } from "@/components/features/painel-shell";

export default function PainelLayout({ children }: { children: ReactNode }) {
  return <PainelShell>{children}</PainelShell>;
}
