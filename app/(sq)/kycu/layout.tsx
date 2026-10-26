import type { ReactNode } from "react";
import "./kfl.css";

export default function KflLayout({ children }: { children: ReactNode }) {
  return <div className="kfl-root">{children}</div>;
}
