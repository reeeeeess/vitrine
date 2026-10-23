// The main process's own calls to the Web API (the account's history every 15 min, the remote control
// while the page is freed) keep to Spotify's pauses too: asking during one only lengthens it.
import { net } from "electron";
import { areaOf, PauseBook, pauseLength, pauseMessage } from "../src/renderer/lib/spotifyLimit";

const pauses = new PauseBook();

/** net.fetch to the Web API, refused at once while Spotify makes that part wait. */
export async function spotifyFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const until = pauses.get(url);
  if (until) throw new Error(pauseMessage(until, areaOf(url)));
  const response = await net.fetch(url, init);
  if (response.status === 429) pauses.set(url, Date.now() + pauseLength(response.headers.get("retry-after"), 3));
  return response;
}
