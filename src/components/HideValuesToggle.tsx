import { Eye, EyeOff } from "lucide-react";

/** Botão "Ocultar/Mostrar valores" do topo das telas com dinheiro. */
export function HideValuesToggle({ showValues, onToggle }: { showValues: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex min-h-11 items-center gap-2 rounded-full bg-card px-4 text-sm text-muted-foreground shadow-card hover:text-foreground"
      aria-pressed={showValues}
    >
      {showValues ? <EyeOff size={16} strokeWidth={1.75} aria-hidden /> : <Eye size={16} strokeWidth={1.75} aria-hidden />}
      {showValues ? "Ocultar valores" : "Mostrar valores"}
    </button>
  );
}
