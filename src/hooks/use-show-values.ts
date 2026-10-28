import { useState } from "react";
import { useDemo } from "@/lib/data/demo-store";
import { maskMoney } from "@/lib/labels";

/**
 * Mostrar ou esconder valores nesta tela. Começa pela preferência do perfil ("ocultar valores por
 * padrão") e vale só enquanto a tela está aberta.
 */
export function useShowValues() {
  const s = useDemo();
  const [showValues, setShowValues] = useState(!s.profile.hideValues);
  return {
    showValues,
    toggle: () => setShowValues((v) => !v),
    /** `mask(formatWealth)(v)` formata ou devolve "R$ •••". */
    mask: (fmt: (v: number) => string) => maskMoney(showValues, fmt),
  };
}
