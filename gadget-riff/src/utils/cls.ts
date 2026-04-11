export function cls(...args: (string | false | undefined | null)[]): string {
  return args.filter(Boolean).join(" ");
}
