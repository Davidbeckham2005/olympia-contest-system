import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import { config } from "../config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.join(__dirname, "../uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024 },
});

export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 },
});

// Âm thanh lưu TRỰC TIẾP vào CSDL (base64) để không mất khi deploy lại → giới hạn
// nhỏ hơn để không phình file DB và payload socket mỗi lần gửi trạng thái.
export const uploadSoundMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const uploadImport = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

// Cloudinary sẵn sàng khi có đủ 3 biến môi trường; nếu chưa cấu hình sẽ tự
// fallback về lưu file trên đĩa cục bộ (server/uploads) để chạy local/dev.
export const cloudinaryConfigured = Boolean(
  config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret
);

let cloudinaryClient = null;
async function getCloudinary() {
  if (!cloudinaryConfigured) return null;
  if (!cloudinaryClient) {
    const { v2: cloudinary } = await import("cloudinary");
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
    });
    cloudinaryClient = cloudinary;
  }
  return cloudinaryClient;
}

// Upload một buffer lên Cloudinary (image/video). Trả về URL HTTPS trực tiếp.
// Nếu Cloudinary chưa cấu hình, ghi file local và trả về đường dẫn /uploads/...
export async function uploadToCloudinary(buffer, { folder, publicId, resourceType, filename, originalname, mimetype }) {
  const cloudinary = await getCloudinary();
  if (!cloudinary) {
    const ext = path.extname(originalname || "").toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
    return { cloudinary: false, url: `/uploads/${name}` };
  }
  const mime = mimetype || (resourceType === "video" ? "video/mp4" : "image/png");
  const b64 = `data:${mime};base64,${buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(b64, {
    folder: folder || "cuoc-thi",
    public_id: publicId,
    resource_type: resourceType === "video" ? "video" : "image",
    overwrite: true,
  });
  return { cloudinary: true, url: result.secure_url, publicId: result.public_id };
}