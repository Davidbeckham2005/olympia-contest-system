import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import routes from "./routes/index.js";
import { UPLOAD_DIR } from "./middleware/upload.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "8mb" }));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use("/api", routes);

// Serve client build (production): toàn bộ app chạy cùng 1 origin.
const DIST_DIR = path.join(__dirname, "../client/dist");
if (fs.existsSync(path.join(DIST_DIR, "index.html"))) {
  app.use(express.static(DIST_DIR));
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
