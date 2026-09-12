import express from "express";
import cors from "cors";
import compression from "compression";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import routes from "./routes/index.js";
import { UPLOAD_DIR } from "./middleware/upload.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors({ origin: true }));
app.use(compression());
app.use(express.json({ limit: "8mb" }));
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d", immutable: true, etag: true }));
app.use("/api", routes);

// Serve client build (production): toàn bộ app chạy cùng 1 origin.
const DIST_DIR = path.join(__dirname, "../client/dist");
if (fs.existsSync(path.join(DIST_DIR, "index.html"))) {
  // index.html: không cache lâu (luôn check lại bản mới); asset có hash Vite thì cache 1 năm.
  app.use(express.static(DIST_DIR, {
    index: "index.html",
    setHeaders(res, filePath) {
      if (/\.(js|css|svg|png|jpg|jpeg|webp|woff2?)$/.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }));
  // SPA fallback: route không phải API/upload/socket trả về index.html cho BrowserRouter.
  app.use((req, res, next) => {
    if (
      req.method !== "GET" ||
      ["/api", "/uploads", "/socket.io"].some((p) => req.path.startsWith(p))
    ) {
      return next();
    }
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

export default app;
