import { useEffect, useState } from "react";

const TICK_MS = 18;

/** Para respostas longas, avançar mais caracteres por tick para não exceder o intervalo de play. */
function charsPerTick(length: number): number {
  if (length > 4000) return 48;
  if (length > 1500) return 24;
  if (length > 400) return 8;
  return 3;
}

/**
 * Revela texto gradualmente quando `run` é true; caso contrário mostra `fullText` de imediato.
 * Reinicia quando `resetKey` muda.
 */
export function useRevealText(
  fullText: string,
  run: boolean,
  resetKey: string
): string {
  const [displayed, setDisplayed] = useState(() =>
    run ? "" : fullText
  );

  useEffect(() => {
    if (!run) {
      setDisplayed(fullText);
      return;
    }

    setDisplayed("");
    let cancelled = false;
    let index = 0;
    const step = charsPerTick(fullText.length);

    const id = window.setInterval(() => {
      if (cancelled) return;
      index += step;
      if (index >= fullText.length) {
        setDisplayed(fullText);
        window.clearInterval(id);
        return;
      }
      setDisplayed(fullText.slice(0, index));
    }, TICK_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [fullText, run, resetKey]);

  return displayed;
}
