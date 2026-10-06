/** Prepare a browser photo/screenshot for a low-latency maalam Live image turn. */

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_EDGE = 2304;
const MAX_PIXELS = 4_200_000;

export type PreparedImage = {
  data: string;
  mimeType: "image/jpeg";
  blob: Blob;
  width: number;
  height: number;
};

const IMAGE_EXT = /\.(?:jpe?g|png|webp|heic|heif)$/i;

export function isImageFile(file: File): boolean {
  return /^(image\/(?:jpeg|png|webp|heic|heif))$/i.test(file.type) ||
    (!file.type && IMAGE_EXT.test(file.name));
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return reject(new Error("Image read failed"));
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Image read failed"));
    reader.readAsDataURL(blob);
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not prepare the image"))),
      "image/jpeg",
      0.9,
    );
  });
}

async function loadImage(file: File): Promise<{ image: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Fall back to the browser's image decoder (useful for iOS camera photos).
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function prepareImageForLive(file: File): Promise<PreparedImage> {
  if (!isImageFile(file)) throw new Error("غير صور JPG، PNG، WebP و HEIC اللي مقبولة.");
  if (!file.size || file.size > MAX_IMAGE_BYTES) {
    throw new Error("الصورة خاصها تكون أقل من 20 MB.");
  }

  let decoded: Awaited<ReturnType<typeof loadImage>>;
  try {
    decoded = await loadImage(file);
  } catch {
    throw new Error("ما قدرناش نفتحو هاد الصورة. جرّب JPG أو PNG واضح.");
  }
  try {
    if (!decoded.width || !decoded.height) throw new Error("The image is empty or damaged.");
    // Keep small math symbols readable while bounding upload bytes and latency.
    const scale = Math.min(
      1,
      MAX_EDGE / Math.max(decoded.width, decoded.height),
      Math.sqrt(MAX_PIXELS / (decoded.width * decoded.height)),
    );
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Image processing is not available in this browser.");
    context.fillStyle = "#fff"; // Transparent screenshots otherwise turn black.
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.image, 0, 0, width, height);
    const blob = await canvasToJpeg(canvas);
    return { data: await toBase64(blob), mimeType: "image/jpeg", blob, width, height };
  } finally {
    decoded.close();
  }
}