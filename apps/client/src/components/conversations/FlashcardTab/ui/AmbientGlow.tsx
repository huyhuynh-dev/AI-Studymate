/**
 * Nền môi trường cực nhẹ. Dùng gradient "closest-side" nên màu tắt hoàn toàn trước khi chạm mép
 * vùng chứa → không còn vệt loang hay cạnh cắt cứng.
 */
export function AmbientGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        background:
          "radial-gradient(ellipse closest-side at 28% 22%, rgba(79,70,229,0.045), transparent), radial-gradient(ellipse closest-side at 74% 78%, rgba(108,248,187,0.05), transparent)",
      }}
    />
  );
}
