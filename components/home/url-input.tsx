"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readJson } from "@/lib/client/api";

function getErrorMessage(error: unknown, defaultMessage: string) {
  return error instanceof Error ? error.message : defaultMessage;
}

function resizeTextarea(element: HTMLTextAreaElement) {
  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, 200)}px`;
}

export function HomeUrlInput() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("请输入视频网址");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/video-brief/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await readJson(response);
      const archive = data.archive as { id: string } | undefined;
      if (archive?.id) {
        router.push(`/v/${archive.id}`);
      } else {
        setError("分析完成，但未返回视频详情");
      }
    } catch (analyzeError) {
      setError(getErrorMessage(analyzeError, "视频速览失败"));
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit(event as unknown as FormEvent);
    }
  }

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setUrl(event.target.value);
    resizeTextarea(event.target);
  }

  return (
    <div className="home-input-wrapper">
      <form onSubmit={handleSubmit} className="home-input-form">
        <div className="home-input">
          <Link2 className="home-input-icon" />
          <textarea
            ref={textareaRef}
            value={url}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="粘贴视频链接，支持 B 站、抖音、YouTube 等"
            rows={1}
            disabled={loading}
            className="home-input-field"
          />
          <Button
            type="submit"
            disabled={loading || !url.trim()}
            className="home-input-send"
            aria-label="开始速览"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </Button>
        </div>
      </form>
      {error ? <p className="home-input-error">{error}</p> : null}
    </div>
  );
}
