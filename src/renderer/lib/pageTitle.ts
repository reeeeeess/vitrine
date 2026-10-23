// The page's big title folds into the header once it scrolls away (Apple Music's large titles).
import { useEffect, type RefObject } from "react";
import { createStore } from "./store";

export const pageTitle = createStore<{ text: string | null }>({ text: null });

/** Watches the page's big title: once it is under the header, the header shows it small. */
export function usePageTitle(ref: RefObject<HTMLElement | null>, text: string | undefined): void {
  // the title may only appear once the page has loaded: watched again when the element changes
  const element = ref.current;
  useEffect(() => {
    if (!element || !text) return;
    // the header is 64 px high: a title behind it is out of sight
    const observer = new IntersectionObserver(([entry]) => pageTitle.set({ text: entry.isIntersecting ? null : text }), { rootMargin: "-64px 0px 0px 0px" });
    observer.observe(element);
    return () => {
      observer.disconnect();
      pageTitle.set({ text: null });
    };
  }, [element, text]);
}
