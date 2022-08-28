// ----- FreeShow -----
// This is for media (image / video) functions

export function getExtension(path: string): string {
  if (!path) return ""
  return path.substring(path.lastIndexOf(".") + 1)
}
