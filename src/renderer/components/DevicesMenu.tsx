import { motion } from "framer-motion";
import { Laptop, MonitorSpeaker, RefreshCw, Smartphone, Speaker, Tv } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { errorMessage } from "../lib/format";
import * as api from "../lib/spotify";
import { useStore } from "../lib/store";
import { notify, ui } from "../lib/ui";
import { playback, transferTo } from "../player/engine";

function DeviceIcon({ type }: { type: string }) {
  const kind = type.toLowerCase();
  const Icon = kind === "smartphone" ? Smartphone : kind === "speaker" ? Speaker : kind === "tv" ? Tv : kind === "computer" ? Laptop : MonitorSpeaker;
  return <Icon className="h-5 w-5" />;
}

export function DevicesMenu() {
  const activeId = useStore(playback, (s) => s.device?.id);
  const localId = useStore(playback, (s) => s.localDeviceId);
  const sdk = useStore(playback, (s) => s.sdk);
  const sdkMessage = useStore(playback, (s) => s.sdkMessage);
  const [list, setList] = useState<api.Device[]>();
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .devices()
      .then(setList, (error: unknown) => notify(errorMessage(error), "error"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const choose = async (id: string) => {
    try {
      await transferTo(id);
      ui.set({ devicesOpen: false });
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="absolute bottom-[calc(100%+12px)] right-0 z-50 w-80 rounded-2xl border border-white/10 bg-[#141418]/95 p-3 shadow-2xl shadow-black/60 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between px-2 pb-2 pt-1">
        <span className="text-sm font-semibold">Écouter sur</span>
        <button onClick={load} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white" aria-label="Actualiser">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>
      <ul className="space-y-1">
        {(list ?? []).map((device) => {
          const active = device.id === activeId || device.isActive;
          return (
            <li key={device.id}>
              <button
                onClick={() => void choose(device.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/10",
                  active && "bg-red-600/15 text-red-300",
                )}
              >
                <DeviceIcon type={device.type} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{device.id === localId ? "Cet ordinateur" : device.name}</span>
                  <span className="block text-xs text-gray-400">{active ? "En cours de lecture" : "Spotify Connect"}</span>
                </span>
              </button>
            </li>
          );
        })}
        {list && list.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">Aucun appareil. Ouvrez Spotify sur votre téléphone ou un autre appareil.</li>}
      </ul>
      {sdk !== "ready" && sdkMessage && (
        <p className="mt-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">{sdkMessage}</p>
      )}
    </motion.div>
  );
}
