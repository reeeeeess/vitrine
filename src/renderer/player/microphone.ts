// The singer's voice through the computer's microphone, as Apple Music Sing lets an iPhone be the mic of
// an Apple TV: the voice comes out of the speakers with a little reverb or an echo, and its level shows.
// Only the person's own voice goes through it: Spotify's sound is never touched.
import { createStore } from "../lib/store";

export type MicEffect = "none" | "studio" | "room" | "stadium" | "echo";

export const MIC_EFFECTS: { key: MicEffect; label: string }[] = [
  { key: "none", label: "Naturel" },
  { key: "studio", label: "Studio" },
  { key: "room", label: "Salle" },
  { key: "stadium", label: "Stade" },
  { key: "echo", label: "Écho" },
];

interface EffectSettings {
  /** how much of the reverb is heard, 0 to 1 */
  reverb: number;
  /** how long the reverb rings, s */
  seconds: number;
  /** how fast it fades: higher is drier */
  decay: number;
  /** how much of the echo is heard, 0 to 1 */
  echo: number;
  echoMs: number;
  /** each repeat of the echo, this much quieter */
  feedback: number;
}

export const EFFECT_SETTINGS: Record<MicEffect, EffectSettings> = {
  none: { reverb: 0, seconds: 0.5, decay: 4, echo: 0, echoMs: 300, feedback: 0 },
  studio: { reverb: 0.22, seconds: 0.9, decay: 3.2, echo: 0, echoMs: 300, feedback: 0 },
  room: { reverb: 0.38, seconds: 1.8, decay: 2.6, echo: 0, echoMs: 300, feedback: 0 },
  stadium: { reverb: 0.5, seconds: 3.6, decay: 2, echo: 0.18, echoMs: 320, feedback: 0.28 },
  echo: { reverb: 0.15, seconds: 1, decay: 3, echo: 0.42, echoMs: 380, feedback: 0.42 },
};

const EFFECT_KEY = "vitrine.micEffect";

function readEffect(): MicEffect {
  try {
    const value = localStorage.getItem(EFFECT_KEY) as MicEffect | null;
    return value && value in EFFECT_SETTINGS ? value : "room";
  } catch {
    return "room";
  }
}

export const mic = createStore({ on: false, starting: false, effect: readEffect(), volume: 0.85, level: 0, error: null as string | null });

/** A reverb's impulse: stereo noise fading out over `seconds`, the way a room, a studio or a stadium answers. */
export function impulse(context: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.max(1, Math.round(context.sampleRate * seconds));
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
  }
  return buffer;
}

/** The level of a stretch of samples, 0 to 1 (RMS, lifted so a voice reads mid-scale). */
export function levelOf(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.min(1, Math.sqrt(sum / Math.max(1, samples.length)) * 4);
}

interface Graph {
  context: AudioContext;
  stream: MediaStream;
  wet: GainNode;
  convolver: ConvolverNode;
  echo: GainNode;
  delay: DelayNode;
  feedback: GainNode;
  output: GainNode;
  timer: ReturnType<typeof setInterval>;
}

let graph: Graph | null = null;

function applyEffect(current: Graph, effect: MicEffect): void {
  const settings = EFFECT_SETTINGS[effect];
  const now = current.context.currentTime;
  current.convolver.buffer = impulse(current.context, settings.seconds, settings.decay);
  current.wet.gain.setTargetAtTime(settings.reverb, now, 0.05);
  current.echo.gain.setTargetAtTime(settings.echo, now, 0.05);
  current.delay.delayTime.setTargetAtTime(settings.echoMs / 1000, now, 0.05);
  current.feedback.gain.setTargetAtTime(settings.feedback, now, 0.05);
}

/** Opens the microphone, raw (no echo cancelling: a voice to sing with, not to call), into the speakers. */
export async function startMic(): Promise<void> {
  if (graph || mic.get().starting) return;
  mic.set({ starting: true, error: null });
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const context = new AudioContext({ latencyHint: "interactive" });
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    const dry = context.createGain();
    const wet = context.createGain();
    const convolver = context.createConvolver();
    const echo = context.createGain();
    const delay = context.createDelay(1.5);
    const feedback = context.createGain();
    const output = context.createGain();
    output.gain.value = mic.get().volume;
    source.connect(analyser);
    source.connect(dry).connect(output);
    source.connect(convolver).connect(wet).connect(output);
    source.connect(delay).connect(echo).connect(output);
    delay.connect(feedback).connect(delay);
    output.connect(context.destination);
    const samples = new Float32Array(analyser.fftSize);
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      mic.set({ level: levelOf(samples) });
    }, 80);
    graph = { context, stream, wet, convolver, echo, delay, feedback, output, timer };
    applyEffect(graph, mic.get().effect);
    mic.set({ on: true, starting: false });
  } catch (error) {
    const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
    mic.set({
      starting: false,
      error: denied
        ? "Accès au micro refusé : dans Windows, Paramètres › Confidentialité › Microphone, autorisez les applications de bureau."
        : error instanceof DOMException && error.name === "NotFoundError"
          ? "Aucun micro trouvé : branchez-en un (ou un casque avec micro)."
          : "Le micro n'a pas pu s'ouvrir.",
    });
  }
}

export function stopMic(): void {
  if (!graph) return;
  clearInterval(graph.timer);
  for (const track of graph.stream.getTracks()) track.stop();
  void graph.context.close().catch(() => undefined);
  graph = null;
  mic.set({ on: false, level: 0 });
}

export function setMicEffect(effect: MicEffect): void {
  mic.set({ effect });
  try {
    localStorage.setItem(EFFECT_KEY, effect);
  } catch {
    // for this run only
  }
  if (graph) applyEffect(graph, effect);
}

export function setMicVolume(volume: number): void {
  mic.set({ volume });
  graph?.output.gain.setTargetAtTime(volume, graph.context.currentTime, 0.03);
}
