import { siteFontVars } from "@/components/siteFonts";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <div className={siteFontVars}>{children}</div>;
}
