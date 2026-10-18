import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="wrap" style={{ padding: "96px 32px", minHeight: 420 }}>
        <h1 className="d" style={{ fontSize: 40, margin: 0 }}>That page is not here.</h1>
        <p style={{ fontSize: 17, color: "#4a5b6a" }}>Try the <Link href="/knowledge-base">knowledge base</Link> or go back to the <Link href="/">home page</Link>.</p>
      </main>
      <SiteFooter />
    </>
  );
}
