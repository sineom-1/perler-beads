import type { ImagePixels } from "./pixelate";

async function decodeSource(src: string, maxSide: number): Promise<ImagePixels> {
  const image = new Image();
  image.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("无法读取图片"));
  });
  image.src = src;
  await loaded;

  const longest = Math.max(image.width, image.height);
  const scale = longest > maxSide ? maxSide / longest : 1;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("浏览器不支持画布");
  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return { width, height, data: imageData.data };
}

export async function decodeImageFile(file: File, maxSide = 1600): Promise<ImagePixels> {
  const url = URL.createObjectURL(file);
  try {
    return await decodeSource(url, maxSide);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function decodeImageUrl(url: string, maxSide = 1600): Promise<ImagePixels> {
  return decodeSource(url, maxSide);
}
