import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** Botão de ação sem volta: o primeiro toque pede confirmação, o segundo executa. */
export function ConfirmButton({
  children,
  confirmLabel = "Toque de novo para confirmar",
  onConfirm,
  className,
  size,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
  size?: "sm";
  "aria-label"?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      variant="ghost"
      size={size}
      className={armed ? `${className ?? ""} text-destructive` : className}
      aria-live="polite"
      aria-label={armed ? undefined : ariaLabel}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}
