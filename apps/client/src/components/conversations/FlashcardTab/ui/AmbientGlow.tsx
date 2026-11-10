/**
 * Nền môi trường cực nhẹ. Dùng gradient "closest-side" nên màu tắt hoàn toàn trước khi chạm mép
 * vùng chứa → không còn vệt loang hay cạnh cắt cứng.
 */
export function AmbientGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 opacity-80 dark:opacity-40"
      style={{
        background:
          "radial-gradient(ellipse closest-side at 28% 22%, rgba(79,70,229,0.04), transparent), radial-gradient(ellipse closest-side at 74% 78%, rgba(16,185,129,0.035), transparent)",
      }}
    />
  );
}
