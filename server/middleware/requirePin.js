import { getDb } from "../models/store.js";
import { config } from "../config/env.js";

// Nguồn duy nhất quyết định giá trị chứng thực BTC hợp lệ:
// - Production: chỉ ADMIN_TOKEN từ env được chấp nhận (khu vực BTC bảo vệ chặt).
// - Dev (mặc định): dùng PIN lưu trong DB (settings.pin).
export function expectedPin() {
  return config.isProduction ? config.adminToken : String(getDb().settings.pin ?? "");
}

export function checkPin(pin) {
  const expected = expectedPin();
  if (!expected) return false;
  const value = String(pin ?? "");
  return value.length === expected.length && value === expected;
}

export function requirePin(req, res, next) {
  const pin = req.headers["x-admin-pin"] || req.body?.pin || req.query.pin;
  if (!checkPin(pin)) {
    const msg = config.isProduction && !config.adminToken
      ? "Khu vực ban tổ chức chưa được kích hoạt (thiếu ADMIN_TOKEN)."
      : "Sai mã PIN ban tổ chức.";
    return res.status(401).json({ error: msg });
  }
  next();
}