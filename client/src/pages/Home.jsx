import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPublicState } from "../lib/api/public.js";

export default function Home() {
  const [info, setInfo] = useState(null);
  // Production (bản build deploy): ẩn entry Ban tổ chức khỏi trang chủ — BTC vào
  // thẳng bằng URL (/dang-nhap, /mc, /admin). Dev vẫn hiện để tiện thao tác.
  const isProd = import.meta.env.PROD;

  useEffect(() => {
    getPublicState().then(setInfo).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen grid place-items-center px-5 py-8">
      <div className="w-[min(1100px,100%)]">
        <div className="kicker">Hệ thống tổ chức cuộc thi</div>
        <h1 className="font-display font-bold text-[clamp(36px,7vw,72px)] leading-[0.95] my-3 drop-shadow-[0_0_28px_rgba(255,214,10,0.25)]">
          {info?.settings?.title || "CUỘC THI TRI THỨC"}
        </h1>
        <p className="text-mist max-w-[640px] mb-9">
          {info?.settings?.subtitle || "Sơ khảo online • 4 đội tranh tài • Điều khiển trực tiếp"}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link className="panel flex flex-col gap-2 min-h-[170px] transition hover:-translate-y-1 hover:border-gold hover:shadow-[0_12px_40px_rgba(0,0,0,0.28)]" to="/thi-sinh">
            <div className="kicker">01</div>
            <b className="text-xl">Thí sinh</b>
            <span className="text-mist text-sm">
              Đăng nhập bằng mật khẩu đội — tự chuyển theo từng vòng: ghi đáp án, bấm chuông, xem bảng.
            </span>
          </Link>
          <Link className="panel flex flex-col gap-2 min-h-[170px] transition hover:-translate-y-1 hover:border-gold hover:shadow-[0_12px_40px_rgba(0,0,0,0.28)]" to="/man-hinh">
            <div className="kicker">02</div>
            <b className="text-xl">Người xem</b>
            <span className="text-mist text-sm">
              Màn hình khán giả/LED: câu hỏi, từ khóa ô tròn, bảng điểm realtime.
            </span>
          </Link>
          {!isProd && (
            <Link className="panel flex flex-col gap-2 min-h-[170px] transition hover:-translate-y-1 hover:border-gold hover:shadow-[0_12px_40px_rgba(0,0,0,0.28)]" to="/mc">
              <div className="kicker">03</div>
              <b className="text-xl">Ban tổ chức</b>
              <span className="text-mist text-sm">
                Bàn điều khiển MC và trang quản trị (câu hỏi, đội, mật khẩu, kết quả).
              </span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
