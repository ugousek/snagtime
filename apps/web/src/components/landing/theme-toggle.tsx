"use client";

import { useEffect } from "react";
import styles from "./landing.module.css";
import { DARK_BG, THEME_KEY } from "./theme";

function applyTheme(dark: boolean) {
  const html = document.documentElement;
  if (dark) {
    html.setAttribute("data-landing-theme", "dark");
    html.style.backgroundColor = DARK_BG;
    html.style.colorScheme = "dark";
  } else {
    html.removeAttribute("data-landing-theme");
    html.style.backgroundColor = "";
    html.style.colorScheme = "";
  }
}

export function ThemeToggle() {
  // The theme belongs to the landing page only; the app itself stays light.
  useEffect(() => {
    try {
      applyTheme(localStorage.getItem(THEME_KEY) === "dark");
    } catch {
      applyTheme(false);
    }
    return () => applyTheme(false);
  }, []);

  const toggle = () => {
    const dark = document.documentElement.getAttribute("data-landing-theme") !== "dark";
    applyTheme(dark);
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {
      // Private mode: the choice just is not remembered.
    }
  };

  return (
    <button type="button" className={styles.themeBtn} onClick={toggle} aria-label="Přepnout světlý a tmavý režim" title="Světlý / tmavý režim">
      <svg className={styles.sun} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg className={styles.moon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
    </button>
  );
}
