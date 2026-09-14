import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Register from "./pages/Register.jsx";
import Exam from "./pages/Exam.jsx";
import ExamResult from "./pages/ExamResult.jsx";
import Audience from "./pages/Audience.jsx";
import Control from "./pages/Control.jsx";
import Admin from "./pages/Admin.jsx";
import Team from "./pages/Team.jsx";
import StaffLogin from "./pages/StaffLogin.jsx";
import ErrorBoundary from "./pages/control/ErrorBoundary.jsx";

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const { pathname } = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dang-ky" element={<Register />} />
        <Route path="/thi" element={<Exam />} />
        <Route path="/ket-qua" element={<ExamResult />} />
        <Route path="/man-hinh" element={<ErrorBoundary><Audience /></ErrorBoundary>} />
        <Route path="/mc" element={<Control />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/thi-sinh" element={<Team />} />
        <Route path="/vong-1" element={<Navigate to="/thi-sinh" replace />} />
        <Route path="/chuong" element={<Navigate to="/thi-sinh" replace />} />
        <Route path="/dang-nhap" element={<StaffLogin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        title={theme === "dark" ? "Bật chế độ sáng" : "Bật chế độ tối"}
        aria-label="Đổi giao diện"
        className={`fixed bottom-5 right-5 z-50 grid h-11 w-11 place-items-center rounded-full border bg-panel border-line text-xl shadow-lg transition hover:scale-105 ${
          ["/", "/man-hinh", "/thi-sinh", "/thi", "/ket-qua", "/vong-1", "/chuong"].includes(pathname) ? "hidden" : ""
        }`}
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>
    </div>
  );
}
