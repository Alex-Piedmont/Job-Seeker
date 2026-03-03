"use client";

import { Heart } from "lucide-react";

export function KofiButton() {
  const kofiId = process.env.NEXT_PUBLIC_KOFI_ID;

  if (!kofiId) return null;

  return (
    <a
      href={`https://ko-fi.com/${kofiId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
    >
      <Heart className="h-4 w-4" />
      <span>Support</span>
    </a>
  );
}
