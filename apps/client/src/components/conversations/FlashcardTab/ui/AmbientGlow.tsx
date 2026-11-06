/** Quầng sáng chàm & bạc hà phía sau để lớp kính mờ có thứ để "xuyên thấu" */
export function AmbientGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-20 -top-24 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl" />
      <div className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-[#6CF8BB]/25 blur-3xl" />
      <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-[#E3D5FF]/30 blur-3xl" />
    </div>
  );
}
