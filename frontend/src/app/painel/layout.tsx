import type { ReactNode } from "react";
import { PainelShell } from "@/components/features/painel-shell";
import { QueryProvider } from "@/components/providers/query-provider";

export default function PainelLayout({ children }: { children: ReactNode }) {
  return (
    <PainelShell>
      <QueryProvider>{children}</QueryProvider>
    </PainelShell>
  );
}
