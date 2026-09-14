import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env") });

export const config = {
  port: Number(process.env.PORT) || 3001,
  // Production (NODE_ENV=production): khu vực ban tổ chức CHỈ mở với ADMIN_TOKEN từ env.
  // Không set token khi production → toàn bộ /admin + /control bị chặn (401).
  isProduction: process.env.NODE_ENV === "production",
  adminToken: process.env.ADMIN_TOKEN || "",
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  },
  db: {
    client: (process.env.DB_CLIENT || "sqlite").toLowerCase(),
    // DATABASE_URL (vd mysql://user:pass@host:3306/dbname hoặc
    // postgres://user:pass@host:5432/dbname) ưu tiên nếu được set — chủ yếu dùng
    // cho nền tảng cấp sẵn connection string. Nếu không có, fallback sang các
    // biến DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME rời.
    url: process.env.DATABASE_URL || "",
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "cuoc_thi",
    // Bật SSL khi DB yêu cầu kết nối mã hoá (VD: Postgres/MySQL của Render)
    ssl: (process.env.DB_SSL || "false").toLowerCase() === "true",
  },
};
