"use client";

import { useState } from "react";

export function CatalogIcon({
  src,
  className = "",
}: {
  src: string;
  className?: string;
}) {
  return <CatalogIconSource key={src} src={src} className={className} />;
}

function CatalogIconSource({
  src,
  className,
}: {
  src: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`catalog-icon-fallback ${className}`.trim()}
        aria-hidden="true"
      >
        ✦
      </span>
    );
  }

  return (
    // External catalog icons must keep their source URL and referrer policy.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      draggable={false}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
