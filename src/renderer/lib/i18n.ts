// Vitrine in English (v1.0). The interface is written in French; in English, each text is swapped for its
// translation as it appears on screen (../i18n/translate.ts), so the screens themselves need no change.
// Names (songs, artists, playlists) and lyrics are never translated: a part of the page marked
// translate="no" is left as it is. Texts drawn on a canvas, sent to Spotify or shown by the system go
// through t().
import { toEnglish } from "../i18n/translate";

export type Language = "fr" | "en";
export type LanguageSetting = "auto" | Language;

const KEY = "vitrine.language";
// outside a page (the tests, the main process), the interface's own French
const system = () => (typeof window !== "undefined" && typeof navigator !== "undefined" ? navigator.language : "fr-FR");

export function languageSetting(): LanguageSetting {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "fr" || saved === "en" ? saved : "auto";
  } catch {
    return "auto";
  }
}

/** "auto": French on a French system, English everywhere else */
export const resolveLanguage = (setting: LanguageSetting, systemLanguage = system()): Language =>
  setting === "auto" ? (systemLanguage.toLowerCase().startsWith("fr") ? "fr" : "en") : setting;

/** the language of this session: a change reloads the page */
export const LANG: Language = resolveLanguage(languageSetting());

/** numbers and dates: French ones in French, the system's own English otherwise */
export const LOCALE = LANG === "fr" ? "fr-FR" : system().toLowerCase().startsWith("en") ? system() : "en-US";

/** A text of the interface in the session's language. */
export const t = (text: string): string => (LANG === "fr" ? text : toEnglish(text));

/** Saves the choice, tells the main process (tray, dialogs) and reloads the page in the new language. */
export function setLanguage(next: LanguageSetting): void {
  try {
    if (next === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    // the choice lasts this session only
  }
  void Promise.resolve(window.vitrine?.app?.setLanguage(next)).finally(() => location.reload());
}

const SKIP = "[translate='no'], script, style, textarea, [contenteditable='true']";
const ATTRIBUTES = ["title", "aria-label", "placeholder", "alt"];
/** what Vitrine itself wrote in a node, so its own change is not translated again */
const written = new WeakMap<Node, string>();
const writtenAttributes = new WeakMap<Element, Record<string, string>>();

function translateText(node: Text): void {
  const value = node.data;
  if (written.get(node) === value || !value.trim()) return;
  const english = toEnglish(value);
  if (english === value) return;
  written.set(node, english);
  node.data = english;
}

function translateAttribute(element: Element, name: string): void {
  const value = element.getAttribute(name);
  const done = writtenAttributes.get(element) ?? {};
  if (!value || done[name] === value) return;
  const english = toEnglish(value);
  if (english === value) return;
  done[name] = english;
  writtenAttributes.set(element, done);
  element.setAttribute(name, english);
}

function translateTree(root: Node): void {
  const start = root.nodeType === Node.TEXT_NODE ? root.parentElement : (root as Element);
  if (!start || start.closest?.(SKIP)) return;
  if (root.nodeType === Node.TEXT_NODE) return translateText(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.nodeType === Node.ELEMENT_NODE && (node as Element).matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let node: Node | null = walker.currentNode; node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) translateText(node as Text);
    else for (const name of ATTRIBUTES) if ((node as Element).hasAttribute(name)) translateAttribute(node as Element, name);
  }
}

/** In English, translates the page now and every text that appears or changes from then on. */
export function startTranslating(root: HTMLElement = document.body): void {
  document.documentElement.lang = LANG;
  if (LANG === "fr") return;
  translateTree(root);
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "childList") record.addedNodes.forEach(translateTree);
      else if (record.type === "characterData") {
        const parent = record.target.parentElement;
        if (parent && !parent.closest(SKIP)) translateText(record.target as Text);
      } else if (record.attributeName && !(record.target as Element).closest(SKIP)) translateAttribute(record.target as Element, record.attributeName);
    }
  }).observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
}
