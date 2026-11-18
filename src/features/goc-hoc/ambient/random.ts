/* Số ngẫu nhiên có seed (mulberry32): sao, giọt mưa, bụi, đèn dây được rải ngẫu nhiên như prototype
   nhưng server và client sinh ra cùng một bộ, nên không lệch lúc hydrate. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
