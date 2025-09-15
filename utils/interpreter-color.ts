import colorsJson from "@/config/interpreter-colors.json";
const colors: Record<string, string> = colorsJson as unknown as Record<string, string>;

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}
function hslFromName(name: string) {
  const h = hash(name) % 360;
  return `hsl(${h} 65% 55%)`;
}
export function getInterpreterColor(interpreterId?: string|null, interpreterName?: string) {
  if (interpreterId && colors[interpreterId]) {
    const bg = colors[interpreterId];
    return { bg, border: bg };
  }
  if (!interpreterName || interpreterName === "no assign now") return null;
  const bg = hslFromName(interpreterName);
  return { bg, border: bg };
}
