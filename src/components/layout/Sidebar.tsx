import { MoreHorizontal, Sparkles, Home, Zap, FileText, Boxes } from "lucide-react";
import { NavLink } from "react-router-dom";
import person from "@/assets/person.jpg";

const nav = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/energy", icon: Zap, label: "Energy" },
  { to: "/invoices", icon: FileText, label: "Invoice" },
  { to: "/devices", icon: Boxes, label: "Devices" },
];

export function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Smart home navigation">
      <div className="brand-mark" aria-label="Mas Ari Smart Home">
        <Sparkles size={22} strokeWidth={2.25} />
      </div>

      <nav className="sidebar-nav">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => `sidebar-item ${isActive ? "is-active" : ""}`}
            aria-label={item.label}
          >
            <span className="sidebar-item__icon">
              <item.icon size={18} strokeWidth={2.25} />
            </span>
            <span className="sidebar-item__label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-user">
        <button aria-label="More options" className="sidebar-more" type="button">
          <MoreHorizontal size={17} />
        </button>
        <img alt="Mas Ari profile" className="sidebar-avatar" src={person} />
      </div>
    </aside>
  );
}
