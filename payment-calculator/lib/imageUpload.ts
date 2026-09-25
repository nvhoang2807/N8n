/**
 * Nén ảnh phía trình duyệt trước khi lưu (ảnh được lưu dạng data URL cùng cấu hình dự án,
 * nên cần nhỏ gọn — không gọi lên máy chủ, không cần Blob riêng cho ảnh).
 */

const MAX_WIDTH = 1280;
const MAX_BYTES = 500_000; // ~500 KB, đủ nhẹ để nằm trong JSON dự án

export class ImageTooLargeError extends Error {}

/** Đọc file ảnh, thu nhỏ về tối đa 1280px, nén JPEG tới khi đủ nhẹ. Trả về data URL. */
export async function fileToCompressedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Vui lòng chọn file ảnh (JPG, PNG, WEBP…).");
  if (file.size > 20_000_000) throw new Error("File quá lớn (tối đa 20MB).");

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
  // Nền trắng cho ảnh PNG có nền trong suốt
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const toDataUrl = (quality: number) =>
    new Promise<string>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Không nén được ảnh."));
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Không đọc được ảnh."));
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        quality,
      );
    });

  let quality = 0.85;
  let dataUrl = await toDataUrl(quality);
  while (dataUrl.length > MAX_BYTES && quality > 0.35) {
    quality -= 0.15;
    dataUrl = await toDataUrl(quality);
  }
  if (dataUrl.length > MAX_BYTES) {
    throw new ImageTooLargeError("Ảnh vẫn còn nặng sau khi nén — vui lòng chọn ảnh khác hoặc ảnh có kích thước nhỏ hơn.");
  }
  return dataUrl;
}
