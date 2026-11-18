import type { Metadata } from "next";
import { PixelDemo } from "@/pixel-stage/demo/PixelDemo";

export const metadata: Metadata = {
  title: "Pixel Stage · demo",
  description: "Trang thử engine animation pixel chibi đồng bộ theo từng dòng code của Programming EDU.",
};

export default function PixelStagePage() {
  return <PixelDemo />;
}
