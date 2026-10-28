// Aparência comum dos gráficos (Recharts): eixos, grade e tooltip seguem os tokens do tema.

export const AXIS_TICK = { fontSize: 12, fill: "var(--muted-foreground)" };

/** Props da <CartesianGrid>: só linhas horizontais, na cor da borda. */
export const GRID = { stroke: "var(--border)", vertical: false } as const;

export const TOOLTIP_STYLE = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 };
