import { useId, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function Help({ text, label }: { text: string; label: string }) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={`O que é ${label}?`}
        className="-my-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <HelpCircle size={16} strokeWidth={1.75} aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="max-w-xs text-sm">{text}</PopoverContent>
    </Popover>
  );
}

/** Campo numérico com rótulo. `prefix` aparece antes do valor (ex.: R$). */
export function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  help,
  hint,
  min,
  max,
  step,
  optional,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  prefix?: string;
  suffix?: string;
  help?: string;
  hint?: ReactNode;
  min?: number;
  max?: number;
  step?: number;
  optional?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
          {optional && <span className="font-normal text-muted-foreground"> (opcional)</span>}
        </label>
        {help && <Help text={help} label={label.toLowerCase()} />}
      </div>
      <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-input bg-muted px-3 focus-within:ring-2 focus-within:ring-ring">
        {prefix && <span className="text-muted-foreground">{prefix}</span>}
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step ?? "any"}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="money h-11 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
        />
        {suffix && <span className="text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <p className="mt-1.5 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Controle segmentado acessível (radiogroup). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={
            "min-h-10 flex-1 rounded-full px-3 text-sm transition-colors " +
            (value === o.value ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LegalNote({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-5 text-muted-foreground">{children}</p>;
}
