"use client";

import { useEffect, useRef } from "react";

export function RootNetwork() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const paths = container.querySelectorAll(".root-path");
    if (paths.length === 0) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          paths.forEach((path, i) => {
            const el = path as HTMLElement;
            el.style.animationDelay = `${i * 0.12}s`;
          });
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-x-0 bottom-0 h-48 overflow-hidden opacity-30"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1440 260"
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          className="root-path"
          d="M720,260 C720,210 712,150 720,80"
          stroke="var(--forest)"
          strokeWidth="1.2"
          fill="none"
          strokeDasharray="400"
          strokeDashoffset="400"
        />
        <path
          className="root-path"
          d="M720,200 C660,180 580,190 500,210"
          stroke="var(--forest)"
          strokeWidth="0.9"
          fill="none"
          strokeDasharray="300"
          strokeDashoffset="300"
        />
        <path
          className="root-path"
          d="M720,200 C780,180 860,190 940,210"
          stroke="var(--forest)"
          strokeWidth="0.9"
          fill="none"
          strokeDasharray="300"
          strokeDashoffset="300"
        />
        <path
          className="root-path"
          d="M720,150 C640,130 540,140 440,160"
          stroke="var(--forest)"
          strokeWidth="0.9"
          fill="none"
          strokeDasharray="350"
          strokeDashoffset="350"
        />
        <path
          className="root-path"
          d="M720,150 C800,130 900,140 1000,160"
          stroke="var(--forest)"
          strokeWidth="0.9"
          fill="none"
          strokeDasharray="350"
          strokeDashoffset="350"
        />
        <path
          className="root-path"
          d="M720,100 C680,80 620,70 560,80"
          stroke="var(--forest)"
          strokeWidth="0.7"
          fill="none"
          strokeDasharray="250"
          strokeDashoffset="250"
        />
        <path
          className="root-path"
          d="M720,100 C760,80 820,70 880,80"
          stroke="var(--forest)"
          strokeWidth="0.7"
          fill="none"
          strokeDasharray="250"
          strokeDashoffset="250"
        />
        <path
          className="root-path"
          d="M720,100 C720,55 720,25 720,0"
          stroke="var(--forest)"
          strokeWidth="0.5"
          fill="none"
          strokeDasharray="200"
          strokeDashoffset="200"
        />
        <path
          className="root-path"
          d="M500,210 C460,230 400,240 350,230"
          stroke="var(--forest)"
          strokeWidth="0.6"
          fill="none"
          strokeDasharray="200"
          strokeDashoffset="200"
        />
        <path
          className="root-path"
          d="M940,210 C980,230 1040,240 1090,230"
          stroke="var(--forest)"
          strokeWidth="0.6"
          fill="none"
          strokeDasharray="200"
          strokeDashoffset="200"
        />
      </svg>
    </div>
  );
}