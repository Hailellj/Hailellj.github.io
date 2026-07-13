import type { Metadata } from "next";
import { ResumeViewer } from "./ResumeViewer";

export const metadata: Metadata = {
  title: {
    absolute: "廖丽君 Haile | AI Marketing & GTM",
  },
  description:
    "廖丽君 Haile 的 AI Marketing & GTM 个人简历，包含 AI 产品探索、海外社媒增长、品牌内容与 GCC 市场经验。",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  openGraph: {
    title: "廖丽君 Haile | AI Marketing & GTM",
    description: "AI 产品探索，海外社媒增长，品牌内容与 GCC 市场经验。",
    type: "profile",
    images: [
      {
        url: "/og.png",
        width: 2304,
        height: 1296,
        alt: "廖丽君 Haile 的 AI Marketing & GTM 简历封面",
      },
    ],
  },
};

export default function Home() {
  return <ResumeViewer />;
}
