export function normalizeVideoBriefAssetUrl(value: string) {
  const trimmed = String(value || "").trim();
  return trimmed.startsWith("http://") ? `https://${trimmed.slice("http://".length)}` : trimmed;
}
