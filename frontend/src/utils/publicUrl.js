/** Build the canonical public document URL used by both View and Copy Link. */
export function buildPublicDocumentUrl(directory, documentName, origin = window.location.origin) {
  if (!directory || !documentName) return "";

  const encodedDirectory = encodeURIComponent(String(directory).trim());
  const encodedPath = String(documentName)
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${String(origin || window.location.origin).replace(/\/$/, "")}/${encodedDirectory}/${encodedPath}`;
}
