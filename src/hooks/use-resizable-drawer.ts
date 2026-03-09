"use client";

import { useState, useCallback, useRef } from "react";

const DRAWER_MIN_W = 400;
const DRAWER_MAX_W_RATIO = 0.9;
const DRAWER_STORAGE_KEY = "drawer-width";

function getInitialWidth(): number {
  if (typeof window === "undefined") return 672;
  const stored = localStorage.getItem(DRAWER_STORAGE_KEY);
  if (stored) {
    const w = parseInt(stored, 10);
    if (!isNaN(w)) {
      return Math.min(Math.max(w, DRAWER_MIN_W), window.innerWidth * DRAWER_MAX_W_RATIO);
    }
  }
  return Math.min(window.innerWidth * 0.6, 672);
}

export function useResizableDrawer() {
  const [drawerWidth, setDrawerWidth] = useState<number>(getInitialWidth);
  const isResizing = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = drawerWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX - ev.clientX;
      const newWidth = Math.min(
        Math.max(startWidth + delta, DRAWER_MIN_W),
        window.innerWidth * DRAWER_MAX_W_RATIO
      );
      setDrawerWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Persist
      setDrawerWidth((w) => {
        if (w) localStorage.setItem(DRAWER_STORAGE_KEY, String(Math.round(w)));
        return w;
      });
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [drawerWidth]);

  return { drawerWidth, handleResizeStart };
}
