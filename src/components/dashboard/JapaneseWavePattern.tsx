"use client";

import { useId } from "react";
import clsx from "clsx";

type JapaneseWavePatternProps = {
  className?: string;
  opacity?: number;
};

/** Reusable seigaiha (waves) tile — a near-invisible decorative texture, never a focal element. */
export default function JapaneseWavePattern({ className, opacity = 0.04 }: JapaneseWavePatternProps) {
  const id = useId();
  return (
    <svg
      aria-hidden="true"
      className={clsx("pointer-events-none absolute inset-0 h-full w-full", className)}
      style={{ opacity }}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id={id} width="56" height="28" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M0,28 a28,28 0 0 1 56,0" />
            <path d="M7,35 a21,21 0 0 1 42,0" />
            <path d="M14,42 a14,14 0 0 1 28,0" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
