import type { ComponentProps } from "react";
import { SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Folha que sobe de baixo, no tamanho padrão do app (coluna de celular, rolagem própria). */
export function BottomSheetContent({ className, ...props }: Omit<ComponentProps<typeof SheetContent>, "side">) {
  return <SheetContent side="bottom" className={cn("mx-auto max-h-[90vh] max-w-[480px] overflow-y-auto rounded-t-2xl", className)} {...props} />;
}
