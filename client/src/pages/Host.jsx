import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { sendControl, getCurrentQuestion } from "../lib/api/control.js";
import { getPin } from "../lib/session.js";
import { formatTime } from "../lib/format.js";
import { on } from "../lib/socket.js";
import { useGameState } from "../lib/useGame.js";
import { activeTeamIds } from "../lib/teams.js";

export default function Host() {
  const nav = useNavigate();
  const { state, timer } = useGameState();
  const [current, setCurrent] = useState(null);

  async function refreshQ() {
    try {
      setCurrent(await getCurrentQuestion());
    } catch {
      nav("/dang-nhap?next=/mc");
    }
  }

  useEffect(() => {
    if (!getPin()) {
      nav("/dang-nhap?next=/mc");
      return;
    }
    refreshQ();
    return on("game:state", () => {
      refreshQ();
    });
  }, [nav]);

  if (!state) return <div className="min-h-screen grid place-items-center text-mist">Đang tải giao diện MC…</div>;

  return (
    <div className="mx-auto w-[min(1000px,calc(100%-24px))] py-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Giao diện MC (Host)</h1>
          <p className="text-mist text-sm">Phong cách dẫn chương trình Đường lên đỉnh Olympia</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/admin" className="btn btn-ghost py-1.5! px-3! text-sm">Giao diện Admin</Link>
          <Link to="/control" className="btn btn-ghost py-1.5! px-3! text-sm">Bàn điều khiển</Link>
        </div>
      </header>
      <div className="panel text-center py-10">
        <p className="text-mist text-lg">Đang hoàn thiện giao diện MC cho vòng thi hiện tại...</p>
      </div>
    </div>
  );
}
