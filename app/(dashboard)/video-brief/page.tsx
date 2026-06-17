import { connection } from "next/server";
import { requirePageSession } from "@/lib/auth";
import { VideoBriefArchivePage } from "@/components/video-brief/archive-page-client";

export default async function VideoBriefPage() {
  await connection();
  await requirePageSession();

  return <VideoBriefArchivePage />;
}
