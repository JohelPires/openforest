"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface BreadcrumbContextValue {
  segments: string[];
  setSegments: (segments: string[]) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

const join = (segments: string[]): string => segments.join("\u0000");

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [segments, setState] = useState<string[]>([]);

  const setSegments = useCallback((next: string[]) => {
    setState((prev) => (join(prev) === join(next) ? prev : next));
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ segments, setSegments }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb(segments: string[]) {
  const context = useContext(BreadcrumbContext);
  const key = join(segments);

  useEffect(() => {
    if (context) context.setSegments(key === "" ? [] : key.split("\u0000"));
  }, [context, key]);
}

export function useBreadcrumbSegments(): string[] {
  const context = useContext(BreadcrumbContext);
  return context?.segments ?? [];
}
