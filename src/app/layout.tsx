import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "数豆格 - 拼豆图纸在线生成与 1:1 分板打印工具",
  description: "数豆格：传图生成拼豆图纸，支持 291 色号对照、单色高亮与 1:1 分板打印 PDF。支持 MARD、COCO、漫漫、盼盼、咪小窝，图片只在本机处理。",
  applicationName: "数豆格",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FBF7F2",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
