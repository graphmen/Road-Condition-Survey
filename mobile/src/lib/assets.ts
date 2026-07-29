/** Resolve a public asset path for web (/collector/) and native (./) builds. */
export function assetUrl(path: string): string {
  const clean = path.replace(/^\//, "");
  return `${import.meta.env.BASE_URL}${clean}`;
}
