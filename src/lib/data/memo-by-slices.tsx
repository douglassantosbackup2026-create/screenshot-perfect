// React.memo para componentes que recebem o estado inteiro (`s`): renderiza de novo só quando muda uma das
// partes de `s` que ele leu no último render (ou outra prop). As leituras são anotadas sozinhas, como no cache
// de seletores, e seletores em cache chamados dentro dele também contam. Assim um gráfico do Progresso não
// redesenha quando a pessoa lança um gasto que ele não usa.
import { memo, type ComponentType } from "react";
import { trackState, unwrapState, type DemoState } from "@/lib/data/demo-store";

type Reads = { real: DemoState; keys: Set<keyof DemoState>; all: boolean };

export function memoBySlices<P extends { s: DemoState }>(Component: ComponentType<P>, name?: string) {
  const readsOf = new WeakMap<object, Reads>();

  function Tracked(props: P) {
    const rec: Reads = { real: unwrapState(props.s), keys: new Set(), all: false };
    readsOf.set(props, rec);
    // followLive: um clique depois de outras ações lê o estado mais recente, não o do último render.
    const s = trackState(
      rec.real,
      (k) => {
        if (k === "*") rec.all = true;
        else rec.keys.add(k);
      },
      { followLive: true },
    );
    return <Component {...props} s={s} />;
  }
  Tracked.displayName = `memoBySlices(${name ?? Component.displayName ?? Component.name ?? "Component"})`;

  return memo(Tracked, (prev, next) => {
    const prevKeys = Object.keys(prev);
    if (prevKeys.length !== Object.keys(next).length) return false;
    for (const k of prevKeys) {
      if (k !== "s" && !Object.is((prev as Record<string, unknown>)[k], (next as Record<string, unknown>)[k])) return false;
    }
    const rec = readsOf.get(prev);
    if (!rec || rec.all) return false;
    const nextReal = unwrapState(next.s);
    for (const k of rec.keys) if (rec.real[k] !== nextReal[k]) return false;
    // Render pulado: as leituras anotadas continuam valendo para a próxima comparação.
    readsOf.set(next, rec);
    return true;
  });
}
