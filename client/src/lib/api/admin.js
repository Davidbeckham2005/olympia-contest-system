import { getPin } from "../session.js";
import { request } from "../http.js";

export function login(pin) {
  return request("/api/admin/login", { method: "POST", body: { pin } });
}

export function getAdminState() {
  return request("/api/admin/state");
}

export function saveSettings(body) {
  return request("/api/admin/settings", { method: "POST", body });
}

export function saveRoundRules(rules) {
  return request("/api/admin/round-rules", { method: "POST", body: { rules } });
}

export function setKhoiDongAnswerSeconds(seconds) {
  return request("/api/admin/khoi-dong-answer-seconds", { method: "POST", body: { seconds } });
}

export function setKhoiDongTimerSeconds(seconds) {
  return request("/api/admin/khoi-dong-timer-seconds", { method: "POST", body: { seconds } });
}

export function createContestant(body) {
  return request("/api/admin/contestants", { method: "POST", body });
}

export async function importContestantsFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/admin/contestants/import", {
    method: "POST",
    headers: { "x-admin-pin": getPin() },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Đọc tệp thất bại.");
  return data;
}

export function deleteContestant(id) {
  return request(`/api/admin/contestants/${id}`, { method: "DELETE" });
}

export function deleteContestants(ids) {
  return request("/api/admin/contestants/bulk-delete", { method: "POST", body: { ids } });
}

export function divideTeams() {
  return request("/api/admin/divide-teams", { method: "POST", body: {} });
}

export function assignTeams(assignments) {
  return request("/api/admin/assign-teams", { method: "POST", body: { assignments } });
}

export function resetContest() {
  return request("/api/admin/reset", { method: "POST", body: { keepQuestions: true } });
}

export function saveTeams(teams) {
  return request("/api/admin/teams", { method: "POST", body: { teams } });
}

export function saveMainQuestions(main) {
  return request("/api/admin/questions/main", { method: "POST", body: { main } });
}

export async function importVeDichQuestionsFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/admin/questions/ve-dich/import", {
    method: "POST",
    headers: { "x-admin-pin": getPin() },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Đọc tệp thất bại.");
  return data;
}

export async function uploadSound(slot, file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api/admin/sounds/${slot}`, {
    method: "POST",
    headers: { "x-admin-pin": getPin() },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Tải âm thanh thất bại.");
  return data;
}

export function deleteSound(slot) {
  return request(`/api/admin/sounds/${slot}`, { method: "DELETE" });
}

export async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/admin/upload", {
    method: "POST",
    headers: { "x-admin-pin": getPin() },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Tải tệp thất bại.");
  return data;
}
