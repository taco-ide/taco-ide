/**
 * Diff de linhas via LCS. Devolve as linhas adicionadas/alteradas no texto novo
 * (1-based, para decorar no Monaco) e as contagens de +/-.
 *
 * Submissões de código são pequenas, então o DP O(n*m) é barato; mesmo assim há
 * um teto de segurança para evitar travar em arquivos absurdamente grandes.
 */
export type LineDiffResult = {
  /** Linhas no texto NOVO que não existem no antigo (1-based). */
  addedLineNumbers: number[];
  addedCount: number;
  removedCount: number;
  changed: boolean;
};

const EMPTY: LineDiffResult = {
  addedLineNumbers: [],
  addedCount: 0,
  removedCount: 0,
  changed: false,
};

const MAX_LINES = 1500;

function splitLines(text: string): string[] {
  if (!text) return [];
  return text.replace(/\r\n/g, "\n").split("\n");
}

export function lineDiff(oldText: string, newText: string): LineDiffResult {
  if (oldText === newText) return EMPTY;

  const a = splitLines(oldText);
  const b = splitLines(newText);
  const n = a.length;
  const m = b.length;

  // Acima do teto: não destacamos linha a linha, só sinalizamos que mudou.
  if (n > MAX_LINES || m > MAX_LINES) {
    return { addedLineNumbers: [], addedCount: 0, removedCount: 0, changed: true };
  }

  // dp[i][j] = tamanho da LCS de a[i..] e b[j..]
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0)
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] =
        a[i] === b[j]
          ? dp[i + 1]![j + 1]! + 1
          : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const addedLineNumbers: number[] = [];
  let i = 0;
  let j = 0;
  let removedCount = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      i++;
      removedCount++;
    } else {
      addedLineNumbers.push(j + 1);
      j++;
    }
  }
  while (j < m) {
    addedLineNumbers.push(j + 1);
    j++;
  }
  while (i < n) {
    i++;
    removedCount++;
  }

  return {
    addedLineNumbers,
    addedCount: addedLineNumbers.length,
    removedCount,
    changed: addedLineNumbers.length > 0 || removedCount > 0,
  };
}
