export const GROUND_Y = 1;
export const ARENA_R = 14;

export const GROUP_RAG = 1;
export const GROUP_PROP = 2;
export const GROUP_STATIC = 4;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export function contactPoint(contact, out) {
  contact.bi.position.vadd(contact.ri, out);
  return out;
}
