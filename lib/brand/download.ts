// Browser-side saving for brand assets. Nothing is uploaded; files are built in the page.
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const saveText = (text: string, filename: string, type = "image/svg+xml") => saveBlob(new Blob([text], { type }), filename);

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through to the older route */ }
  // Older route for pages without clipboard permission (an unfocused frame, a plain-HTTP preview).
  try {
    const t = document.createElement("textarea");
    t.value = text; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(t); t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  } catch { return false; }
}

/** Rasterises an SVG string to a PNG at the given pixel width (height follows the aspect ratio). */
export function svgToPng(svg: string, width: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalHeight && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1;
      const c = document.createElement("canvas");
      c.width = width; c.height = Math.max(1, Math.round(width * ratio));
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("No canvas"));
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the PNG"))), "image/png");
    };
    img.onerror = () => reject(new Error("Couldn't read the SVG"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}
