// Tối ưu URL video của Cloudinary: chèn transform "so_auto" (source optimized) ngay sau
// /video/upload/. CDN tự chọn codec/kích thước tối ưu cho trình duyệt yêu cầu (~10x nhỏ
// hơn file gốc — đo thực tế 9.09MB → 0.82MB) → phát lũy tiến mượt, không cần HLS
// (sp_auto bị chặn ở gói free). URL local (/uploads/...) hoặc không phải Cloudinary →
// trả nguyên, không đổi hành vi.
export function optimizeVideoUrl(url = "") {
  if (!url || !url.includes("res.cloudinary.com")) return url;
  const m = /^((?:https?:)?\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(.*)$/i.exec(url);
  if (!m) return url;
  const rest = m[2];
  if (rest.split("/").some((seg) => seg.includes("so_auto"))) return url;
  return `${m[1]}so_auto/${rest}`;
}