// Recadre (au centre) et réduit une image AVANT l'envoi: une photo de
// téléphone de 5 Mo devient quelques dizaines de Ko.
export async function resizeImage(file: File, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ko(new Error("Image illisible"));
      i.src = url;
    });
    // Plus grande zone au bon ratio, centrée.
    const ratio = width / height;
    let sw = img.naturalWidth;
    let sh = sw / ratio;
    if (sh > img.naturalHeight) {
      sh = img.naturalHeight;
      sw = sh * ratio;
    }
    const scale = Math.min(1, width / sw);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
    // Safari (iPhone) ne sait pas encoder le WebP: il rend un PNG lourd à
    // la place. On le détecte et on repasse en JPEG, accepté partout.
    let blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", 0.85));
    if (!blob || blob.type !== "image/webp") {
      blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.88));
    }
    if (!blob) throw new Error("Conversion impossible");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
