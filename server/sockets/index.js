import { publicState } from "../services/state.service.js";
import * as game from "../services/game.service.js";

export function registerSockets(io) {
  io.on("connection", (socket) => {
    socket.emit("game:state", game.publicGame());
    socket.emit("game:timer", game.getTimer());
    socket.emit("prelim:update", publicState());

    function teamOk(payload) {
      const ok = payload?.teamId && game.checkTeamPass(payload.teamId, payload.pass);
      if (!ok) socket.emit("team:error", { reason: "auth", message: "Phiên đăng nhập đội không hợp lệ. Hãy đăng nhập lại." });
      return !!ok;
    }

    socket.on("buzzer:press", (payload) => {
      if (!payload?.teamId) return;
      if (!teamOk(payload)) return;
      game.pressBuzzer(payload.teamId, payload.intent);
    });

    socket.on("tangtoc:submit", (payload) => {
      if (!payload?.teamId) return;
      if (!teamOk(payload)) return;
      game.submitTangToc(payload.teamId, payload.answer);
    });

    socket.on("khoidong:submit", (payload) => {
      if (!payload?.teamId) return;
      if (!teamOk(payload)) return;
      game.submitKhoiDong(payload.teamId, payload.answer);
    });

    socket.on("vuotcnv:submit", (payload, ack) => {
      if (!payload?.teamId) return;
      if (!teamOk(payload)) {
        ack?.({ ok: false, reason: "auth" });
        return;
      }
      const r = game.submitRowAnswer(payload.teamId, payload.answer);
      ack?.(r || { ok: false, reason: "not-open" });
    });
  });
}
