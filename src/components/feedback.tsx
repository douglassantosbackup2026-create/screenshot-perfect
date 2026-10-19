import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Award, CalendarCheck, Flag, Map, RefreshCw, Shield, Sprout, Share2, type LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { AchievementCode } from "@/lib/gamification/rules";
import { achievementInfo } from "@/lib/labels";
import type { ActionResult } from "@/lib/data/demo-store";

export const ACH_ICONS: Record<string, LucideIcon> = {
  map: Map,
  sprout: Sprout,
  "calendar-check": CalendarCheck,
  shield: Shield,
  "refresh-cw": RefreshCw,
  flag: Flag,
  award: Award,
};

/** Toast discreto de XP. */
export function xpToast(message: string, xp: number) {
  toast(xp > 0 ? `${message} +${xp} XP` : message);
}

const EVT = "pi:achievements";
/** Mostra a folha de conquista quando a operação retorna conquistas novas. */
export function handleResult(r: Pick<ActionResult, "newAchievements">) {
  if (r.newAchievements.length) window.dispatchEvent(new CustomEvent(EVT, { detail: r.newAchievements }));
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
  const Icon = info ? ACH_ICONS[info.icon] : Award;

  async function share() {
    if (!info) return;
    const blob = await achievementImage(info.title);
    const file = new File([blob], "conquista.png", { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: info.title, text: `Conquista: ${info.title}` }).catch(() => {});
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "conquista.png";
      a.click();
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
              <SheetTitle className="font-display text-xl">{info.title}</SheetTitle>
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
  const g = c.getContext("2d")!;
  const css = getComputedStyle(document.documentElement);
  const color = (v: string, fb: string) => css.getPropertyValue(v).trim() || fb;
  g.fillStyle = color("--background", "#F4F7F6");
  g.fillRect(0, 0, 1080, 1080);
  g.strokeStyle = color("--border", "#CFD9D6");
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(200, 160);
  g.lineTo(200, 920);
  g.stroke();
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.arc(200, 220 + i * 130, 26, 0, Math.PI * 2);
    g.fillStyle = color("--accent", "#E0A526");
    g.fill();
  }
  g.fillStyle = color("--foreground", "#17302C");
  g.font = "600 72px 'Bricolage Grotesque', sans-serif";
  wrap(g, title, 300, 480, 680, 84);
  g.font = "400 36px 'Public Sans', sans-serif";
  g.fillStyle = color("--muted-foreground", "#5B6F6B");
  g.fillText("Previdência Intelligence", 300, 900);
  return new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
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
