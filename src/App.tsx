import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { SmartHomePage } from "@/pages/SmartHomePage";
import { EnergyPage } from "@/pages/EnergyPage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { DevicesPage } from "@/pages/DevicesPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<SmartHomePage />} />
        <Route path="energy" element={<EnergyPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
