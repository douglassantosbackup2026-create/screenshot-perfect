// Campos do livro-caixa: escolha de conta e de categoria.
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { accountKindLabel } from "@/lib/calc/ledger";
import type { Account, Category, CategoryKind } from "@/lib/data/demo-store";
import { cn } from "@/lib/utils";

export function AccountSelect({
  label,
  value,
  onChange,
  accounts,
}: {
  label: string;
  value: string | null;
  onChange: (id: string) => void;
  accounts: Account[];
}) {
  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <Select value={value ?? undefined} onValueChange={onChange}>
        <SelectTrigger className="mt-1.5 h-11 rounded-xl bg-muted" aria-label={label}>
          <SelectValue placeholder="Escolha a conta" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name} <span className="text-muted-foreground">· {accountKindLabel(a.kind)}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CategoryChips({
  value,
  onChange,
  categories,
  kind,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  categories: Category[];
  kind: CategoryKind;
}) {
  return (
    <div>
      <p className="text-sm font-semibold">
        Categoria <span className="font-normal text-muted-foreground">(opcional)</span>
      </p>
      <div role="radiogroup" aria-label="Categoria" className="mt-2 flex flex-wrap gap-2">
        {categories
          .filter((c) => c.kind === kind)
          .map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={value === c.id}
              onClick={() => onChange(value === c.id ? null : c.id)}
              className={cn("min-h-10 rounded-full border px-4 text-sm", value === c.id ? "border-primary font-semibold text-primary" : "border-border")}
            >
              {c.name}
            </button>
          ))}
      </div>
    </div>
  );
}
