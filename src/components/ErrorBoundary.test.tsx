import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CardBoundary, ErrorBoundary } from "./ErrorBoundary";

let broken = true;
function Flaky() {
  if (broken) throw new Error("seletor quebrou");
  return <p>card ok</p>;
}

describe("barreiras de erro", () => {
  it("um card que quebra vira um aviso e o resto da tela continua", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    broken = true;
    render(
      <>
        <CardBoundary>
          <Flaky />
        </CardBoundary>
        <p>resto da tela</p>
      </>,
    );
    expect(screen.getByText("Não foi possível mostrar isto agora.")).toBeInTheDocument();
    expect(screen.getByText("resto da tela")).toBeInTheDocument();

    broken = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(screen.getByText("card ok")).toBeInTheDocument();
  });

  it("tenta de novo sozinha quando a chave muda (troca de tela)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    broken = true;
    const ui = (key: string) => (
      <ErrorBoundary resetKey={key} fallback={() => <p>falhou</p>}>
        <Flaky />
      </ErrorBoundary>
    );
    const { rerender } = render(ui("/hoje"));
    expect(screen.getByText("falhou")).toBeInTheDocument();
    broken = false;
    rerender(ui("/diario"));
    expect(screen.getByText("card ok")).toBeInTheDocument();
  });
});
