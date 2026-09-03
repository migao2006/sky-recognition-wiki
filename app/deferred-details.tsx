"use client";

import { useState, type ReactNode } from "react";

export function DeferredDetails({
  className,
  summary,
  children,
}: {
  className?: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  const [contentMounted, setContentMounted] = useState(false);

  return (
    <details
      className={className}
      onToggle={(event) => {
        if (event.currentTarget.open) setContentMounted(true);
      }}
    >
      <summary>{summary}</summary>
      {contentMounted ? children : null}
    </details>
  );
}
