"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string }
      ) => string;
    };
  }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

// 폼 안에 위젯을 렌더링하면 Turnstile이 자기 컨테이너 안에
// name="cf-turnstile-response" 히든 인풋을 스스로 심어준다.
// 그래서 서버 액션의 formData에 별도 배선 없이 자동으로 실려간다.
export default function Turnstile({ siteKey }: { siteKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function render() {
      if (window.turnstile && container) {
        window.turnstile.render(container, { sitekey: siteKey });
      }
    }

    if (window.turnstile) {
      render();
      return;
    }

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", render, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.addEventListener("load", render, { once: true });
    document.head.appendChild(script);
  }, [siteKey]);

  return <div ref={containerRef} className="flex justify-center" />;
}
