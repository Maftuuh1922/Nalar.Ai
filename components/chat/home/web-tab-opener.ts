import { createContext, useContext } from "react";

/**
 * Lets the markdown link renderers open an http(s) URL in the in-app Viewer
 * (browser-style panel) instead of the browser navigating to a new tab.
 *
 * Provided by the chat page around the message list; `null` outside chat
 * surfaces (quiz, memory, trace, …), where links keep their default behavior.
 */
export const WebTabOpenerContext = createContext<((url: string) => void) | null>(
  null,
);

export function useWebTabOpener(): ((url: string) => void) | null {
  return useContext(WebTabOpenerContext);
}
