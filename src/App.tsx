import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";

const SmartHomePage = lazy(() => import("@/pages/SmartHomePage").then((m) => ({ default: m.SmartHomePage })));
const EnergyPage = lazy(() => import("@/pages/EnergyPage").then((m) => ({ default: m.EnergyPage })));
const InvoicesPage = lazy(() => import("@/pages/InvoicesPage").then((m) => ({ default: m.InvoicesPage })));
const DevicesPage = lazy(() => import("@/pages/DevicesPage").then((m) => ({ default: m.DevicesPage })));

function PageFallback() {
  return <div className="page-fallback">Loading smart apartment…</div>;
}

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<PageFallback />}>{node}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={withSuspense(<SmartHomePage />)} />
        <Route path="energy" element={withSuspense(<EnergyPage />)} />
        <Route path="invoices" element={withSuspense(<InvoicesPage />)} />
        <Route path="devices" element={withSuspense(<DevicesPage />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
