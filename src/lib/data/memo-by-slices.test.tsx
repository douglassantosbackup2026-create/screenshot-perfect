import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { monthOf, spDate } from "@/lib/gamification/rules";

async function fresh() {
  vi.resetModules();
  const store = await import("./demo-store");
  const { memoBySlices } = await import("./memo-by-slices");
  const sel = await import("./selectors");
  return { store, memoBySlices, sel };
}

describe("memoBySlices", () => {
  it("só redesenha quando muda uma parte que o componente leu", async () => {
    const { store, memoBySlices } = await fresh();
    store.demo.reset();
    let renders = 0;
    const Goals = memoBySlices(({ s }: { s: ReturnType<typeof store.useDemo> }) => {
      renders++;
      return <p>{s.goals.length}</p>;
    });
    function Page() {
      const s = store.useDemo();
      return <Goals s={s} />;
    }
    render(<Page />);
    expect(renders).toBe(1);
    const account = () => store.demo.exportData().accounts[0]!;
    act(() => {
      store.demo.addTransaction({ accountId: account().id, date: spDate(new Date()), amount: -100, payee: "Café", categoryId: null });
    });
    act(() => store.demo.updateProfile({ displayName: "Bia" }));
    expect(renders).toBe(1); // nem lançamento nem perfil mexem em metas
    act(() => store.demo.deleteGoal(store.demo.exportData().goals[0]!.id));
    expect(renders).toBe(2);
  });

  it("seletor em cache dentro do componente conta como leitura", async () => {
    const { store, memoBySlices, sel } = await fresh();
    store.demo.reset();
    const month = monthOf(spDate(new Date()));
    let shown = -1;
    const Count = memoBySlices(({ s }: { s: ReturnType<typeof store.useDemo> }) => {
      shown = sel.ledgerMonth(s, month).days.reduce((n, d) => n + d.items.length, 0);
      return null;
    });
    function Page() {
      const s = store.useDemo();
      // Aquece o cache antes do componente: ele vai pegar o resultado pronto.
      sel.ledgerMonth(s, month);
      return <Count s={s} />;
    }
    render(<Page />);
    const before = shown;
    act(() => {
      store.demo.addTransaction({ accountId: store.demo.exportData().accounts[0]!.id, date: spDate(new Date()), amount: -100, payee: "Café", categoryId: null });
    });
    expect(shown).toBe(before + 1);
  });

  it("outra prop diferente também redesenha", async () => {
    const { store, memoBySlices } = await fresh();
    store.demo.reset();
    let renders = 0;
    const Card = memoBySlices(({ s, label }: { s: ReturnType<typeof store.useDemo>; label: string }) => {
      renders++;
      return <p>{label + s.goals.length}</p>;
    });
    function Page({ label }: { label: string }) {
      return <Card s={store.useDemo()} label={label} />;
    }
    const view = render(<Page label="a" />);
    view.rerender(<Page label="a" />);
    expect(renders).toBe(1);
    view.rerender(<Page label="b" />);
    expect(renders).toBe(2);
  });
});
