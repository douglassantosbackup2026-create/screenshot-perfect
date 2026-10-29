import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Award,
  CalendarCheck,
  CalendarRange,
  CheckCircle2,
  Compass,
  FileUp,
  Flag,
  LineChart,
  Map,
  Mountain,
  PieChart,
  RefreshCw,
  Shield,
  Sprout,
  Share2,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { AchievementCode } from "@/lib/gamification/rules";
import { achievementInfo } from "@/lib/labels";
import type { ActionResult } from "@/lib/data/demo-store";
import { JOURNEY_ENABLED } from "@/lib/features";
import { APP_NAME } from "@/lib/seo";
import { errMsg } from "@/lib/errors";

export const ACH_ICONS: Record<string, LucideIcon | undefined> = {
  map: Map,
  sprout: Sprout,
  "calendar-check": CalendarCheck,
  shield: Shield,
  "refresh-cw": RefreshCw,
  flag: Flag,
  award: Award,
  "trending-up": TrendingUp,
  target: Target,
  "check-circle": CheckCircle2,
  "calendar-range": CalendarRange,
  mountain: Mountain,
  compass: Compass,
  "file-up": FileUp,
  wallet: Wallet,
  "line-chart": LineChart,
  "pie-chart": PieChart,
};

/** Toast discreto de XP. */
export function xpToast(message: string, xp: number) {
  toast(JOURNEY_ENABLED && xp > 0 ? `${message} +${xp} XP` : message);
}

const EVT = "pi:achievements";
/** Mostra a folha de conquista quando a operação retorna conquistas novas. */
export function handleResult(r: Pick<ActionResult, "newAchievements">) {
  if (JOURNEY_ENABLED && r.newAchievements.length) window.dispatchEvent(new CustomEvent(EVT, { detail: r.newAchievements }));
}

/**
 * Roda uma operação do store com o retorno de sempre: em caso de sucesso, a mensagem (com XP, se houver)
 * e as conquistas; em erro, a mensagem da regra num toast. Devolve true se deu certo.
 */
const isActionResult = (r: unknown): r is ActionResult =>
  typeof r === "object" && r !== null && "newAchievements" in r && "xpAwarded" in r;

export function runAction<T>(fn: () => T, success?: string | ((r: T) => string)): boolean {
  try {
    const r = fn();
    const result = isActionResult(r) ? r : null;
    if (success) {
      const message = typeof success === "function" ? success(r) : success;
      if (result) xpToast(message, result.xpAwarded);
      else toast(message);
    }
    if (result) handleResult(result);
    return true;
  } catch (e) {
    toast.error(errMsg(e));
    return false;
  }
}

export function AchievementSheet() {
  const [queue, setQueue] = useState<AchievementCode[]>([]);
  useEffect(() => {
    const on = (e: Event) => setQueue((q) => [...q, ...(e as CustomEvent<AchievementCode[]>).detail]);
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  const code = queue[0];
  const info = code ? achievementInfo(code) : null;
  const Icon = (info && ACH_ICONS[info.icon]) || Award;

  async function share() {
    if (!info) return;
    try {
      const blob = await achievementImage(info.title);
      const file = new File([blob], "conquista.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        // Cancelar o compartilhamento não é erro.
        await navigator.share({ files: [file], title: info.title, text: `Conquista: ${info.title}` }).catch(() => {});
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "conquista.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      toast.error("Não foi possível gerar a imagem da conquista.");
    }
  }

  return (
    <Sheet open={!!code} onOpenChange={(o) => !o && setQueue((q) => q.slice(1))}>
      <SheetContent side="bottom" className="mx-auto max-w-[480px] rounded-t-2xl">
        {info && (
          <>
            <SheetHeader className="items-center text-center">
              <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Icon size={28} strokeWidth={1.75} aria-hidden />
              </span>
              <SheetTitle className="text-xl font-semibold">{info.title}</SheetTitle>
              <SheetDescription>{info.description}</SheetDescription>
            </SheetHeader>
            <div className="mt-6 flex flex-col gap-2 pb-2">
              <Button variant="outline" onClick={share}>
                <Share2 size={18} strokeWidth={1.75} aria-hidden /> Compartilhar
              </Button>
              <Button onClick={() => setQueue((q) => q.slice(1))}>Continuar</Button>
              <p className="text-center text-xs text-muted-foreground">A imagem não mostra nenhum valor.</p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Imagem de compartilhamento: nome da conquista e o fio estilizado, sem valores. */
function achievementImage(title: string): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1080;
  const g = c.getContext("2d");
  if (!g) return Promise.reject(new Error("canvas indisponível"));
  const css = getComputedStyle(document.documentElement);
  const color = (v: string, fb: string) => css.getPropertyValue(v).trim() || fb;
  g.fillStyle = color("--background", "#0C0C0B");
  g.fillRect(0, 0, 1080, 1080);
  g.strokeStyle = color("--border", "#2C2C29");
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(200, 160);
  g.lineTo(200, 920);
  g.stroke();
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.arc(200, 220 + i * 130, 26, 0, Math.PI * 2);
    g.fillStyle = color("--accent", "#F6C800");
    g.fill();
  }
  g.fillStyle = color("--foreground", "#F5F5F2");
  g.font = "600 76px 'Poppins', sans-serif";
  wrap(g, title, 300, 480, 680, 92);
  g.font = "500 36px 'Poppins', sans-serif";
  g.fillStyle = color("--muted-foreground", "#A6A49C");
  g.fillText(APP_NAME, 300, 900);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("imagem vazia"))), "image/png"));
}
function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  let line = "";
  for (const w of text.split(" ")) {
    const t = line ? line + " " + w : w;
    if (g.measureText(t).width > max && line) {
      g.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = t;
  }
  g.fillText(line, x, y);
}
