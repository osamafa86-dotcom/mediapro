/** 04:12 / 1:02:03 — durations, always Latin digits and LTR (wrap with ltr() inside Arabic text). */
export const clock = (sec: number) => {
  const x = Math.round(sec);
  const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), r = x % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m).padStart(2, '0')) + `:${String(r).padStart(2, '0')}`;
};
