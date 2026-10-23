// The page's errors go to the report kept on this computer (electron/errorReport.ts); the person is told
// once per session where to find it. Nothing is sent anywhere by itself.
import { notify } from "./ui";

let told = false;

export function recordError(error: unknown): void {
  const value = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
  void window.vitrine?.errors?.add(value).catch(() => undefined);
  if (told) return;
  told = true;
  notify("Une erreur est survenue. Réglages › Rapport d'erreur pour la copier ou l'envoyer.", "error");
}

export function connectErrorLog(): void {
  window.addEventListener("error", (event) => recordError(event.error ?? event.message));
  window.addEventListener("unhandledrejection", (event) => recordError(event.reason));
}
