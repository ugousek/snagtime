export const THEME_KEY = "landing-theme";
export const DARK_BG = "#0a0c10";

/** Runs before first paint so a saved dark choice never flashes light. Light is always the default. */
export const themeBootScript = `(function(){try{if(localStorage.getItem(${JSON.stringify(THEME_KEY)})==="dark"){var h=document.documentElement;h.setAttribute("data-landing-theme","dark");h.style.backgroundColor=${JSON.stringify(DARK_BG)};h.style.colorScheme="dark"}}catch(e){}})()`;
