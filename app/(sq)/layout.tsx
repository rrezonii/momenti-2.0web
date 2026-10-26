import SiteRoot from "@/components/SiteRoot";
export { metadata } from "@/components/SiteRoot";

export default function AlbanianLayout({ children }: { children: React.ReactNode }) {
  return <SiteRoot locale="sq">{children}</SiteRoot>;
}
