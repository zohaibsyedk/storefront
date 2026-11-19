import { siteFontVars } from "@/components/siteFonts";
import { Shell } from "@/components/Shell";

export default async function BusinessLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className={siteFontVars}>
      <Shell id={id}>{children}</Shell>
    </div>
  );
}
