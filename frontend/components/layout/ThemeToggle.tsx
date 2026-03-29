"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "tfm_theme_mode";

const applyTheme = (mode: ThemeMode) => {
  document.documentElement.setAttribute("data-theme", mode);
};

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initialMode: ThemeMode = stored === "dark" ? "dark" : "light";
    setMode(initialMode);
    applyTheme(initialMode);
  }, []);

  const handleToggle = () => {
    const nextMode: ThemeMode = mode === "light" ? "dark" : "light";
    setMode(nextMode);
    applyTheme(nextMode);
    window.localStorage.setItem(STORAGE_KEY, nextMode);
  };

  return (
    <button type="button" className="theme-toggle" onClick={handleToggle} aria-label="Cambiar tema">
      {mode === "light" ? "Modo oscuro" : "Modo claro"}
    </button>
  );
}
