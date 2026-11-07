/** So khớp từng ký tự (LCS): đánh dấu ký tự người dùng gõ đúng / sai / thừa */
export function diffTyped(typed: string, answer: string): { ch: string; ok: boolean }[] {
  const a = [...typed];
  const b = [...answer];
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const marks = a.map(() => false);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      marks[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return a.map((ch, k) => ({ ch, ok: marks[k] }));
}
