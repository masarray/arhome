import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";

export function AppShell() {
  return (
    <main className="app-shell">
      <div className="dashboard-frame">
        <div className="dashboard-grid">
          <Sidebar />
          <Outlet />
        </div>
      </div>
    </main>
  );
}
