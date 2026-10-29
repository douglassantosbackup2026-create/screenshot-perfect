import { createContext, useContext, useState, type ReactNode } from "react";
import { useDemo } from "@/lib/data/demo-store";
import { formatMoney } from "@/lib/calc/format";
import { maskMoney } from "@/lib/labels";

/**
 * Mostrar ou esconder valores nesta tela. Começa pela preferência do perfil ("ocultar valores por
 * padrão") e vale só enquanto a tela está aberta. Passe `showValues` ao `ShowValuesProvider` da tela para
 * que folhas e cards abertos nela sigam o mesmo olho.
 */
export function useShowValues() {
  const s = useDemo();
  const [showValues, setShowValues] = useState(!s.profile.hideValues);
  return { showValues, toggle: () => setShowValues((v) => !v) };
}

const ShowValuesContext = createContext<boolean | null>(null);

/** O olho da tela vale para tudo o que é aberto dentro dela (lançamento, limite, orçamento…). */
export function ShowValuesProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <ShowValuesContext.Provider value={value}>{children}</ShowValuesContext.Provider>;
}

/** Mostrar valores aqui: o olho da tela, se houver; senão, a preferência do perfil. */
export function useShowValuesHere(): boolean {
  const fromScreen = useContext(ShowValuesContext);
  const s = useDemo();
  return fromScreen ?? !s.profile.hideValues;
}

/** Formatador que respeita o olho: `useMoney()(1234)` dá "R$ 12,34" ou "R$ •••". */
export function useMoney(fmt: (v: number) => string = formatMoney): (v: number) => string {
  return maskMoney(useShowValuesHere(), fmt);
}
