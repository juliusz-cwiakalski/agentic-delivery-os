export function choose(kind: "a" | "b" | "c"): number {
  let total = 0;
  switch (kind) {
    case "a":
      total += 1;
    case "b":
      total += 2;
      break;
    default:
      total += 3;
  }
  return total;
}
