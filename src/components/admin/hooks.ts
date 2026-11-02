// Ganchos do painel administrativo: perfis de quem está no painel, permissão de escrita, período e carga de dados.
import { useEffect, useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { toast } from "sonner";
import { spDate } from "@/lib/gamification/rules";
import { errMsg } from "@/lib/errors";
import { canWrite, type AdminPath, type StaffRole } from "@/lib/admin/modules";

const adminRoute = getRouteApi("/_authenticated/admin");

/** Perfis de quem está no painel (vêm do layout /admin). */
export function useStaff(): StaffRole[] {
  return adminRoute.useRouteContext().staff;
}

/** Pode alterar algo neste módulo? Analista e perfis só de leitura não veem os botões. */
export function useCanWrite(path: AdminPath): boolean {
  return canWrite(useStaff(), path);
}

export const daysAgo = (n: number) => spDate(new Date(Date.now() - n * 86_400_000));

export type Period = { from: string; to: string };

/** Chama uma RPC do painel e devolve o resultado (null enquanto carrega). `reload` busca de novo. */
export function useAdminData<T>(load: () => PromiseLike<{ data: unknown; error: unknown }>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    setFailed(false);
    void Promise.resolve(load()).then(
      ({ data, error }) => {
        if (!live) return;
        if (error) {
          setFailed(true);
          toast.error(errMsg(error));
        } else setData(data as T);
      },
      (e: unknown) => {
        if (!live) return;
        setFailed(true);
        toast.error(errMsg(e));
      },
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- quem chama passa as dependências da consulta
  }, [...deps, version]);
  return { data, failed, reload: () => setVersion((v) => v + 1) };
}
