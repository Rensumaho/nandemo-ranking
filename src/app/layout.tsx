import type { Metadata } from "next";
import { M_PLUS_1p } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const mPlus = M_PLUS_1p({
  variable: "--font-main",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

export const metadata: Metadata = {
  title: "なんでもランキング",
  description: "大学ランキングのスコア増減依頼・投票プラットフォーム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={mPlus.variable}>
      <body>
        <header className="siteHeader">
          <div className="container">
            <Link href="/" className="siteTitle">
              なんでもランキング
            </Link>
            <nav className="siteNav">
              <Link href="/">大学ランキング</Link>
              <Link href="/inquiry">問い合わせ</Link>
            </nav>
          </div>
        </header>
        <main className="container contentArea">{children}</main>
      </body>
    </html>
  );
}
