"use client";

import { useEffect, useState } from "react";

let audio: AudioContext | null = null;

// Call from a user gesture (completing a set): browsers only allow audio after one.
export function primeAudio() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audio ??= new Ctx();
    void audio.resume();
  } catch {
    // audio is optional
  }
}

function beep() {
  try {
    if (!audio) return;
    const osc = audio.createOscillator();
    osc.frequency.value = 880;
    osc.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.25);
  } catch {
    // audio is optional
  }
}

export function RestTimer({
  endsAt,
  onChange,
}: {
  endsAt: number;
  onChange: (endsAt: number | null) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (remaining > 0) return;
    navigator.vibrate?.([200, 100, 200]);
    beep();
    const t = setTimeout(() => onChange(null), 1500);
    return () => clearTimeout(t);
  }, [remaining, onChange]);

  const mm = String(Math.floor(remaining / 60)).padStart(1, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  return (
    <div
      role="timer"
      aria-live="off"
      className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-3 bg-neutral-900 px-4 py-3 text-white"
    >
      <span className="text-lg font-semibold tabular-nums">
        {remaining === 0 ? "Los geht's!" : `Pause ${mm}:${ss}`}
      </span>
      <button
        onClick={() => onChange(endsAt - 15_000)}
        className="ml-auto rounded-lg bg-white/15 px-3 py-1 text-sm"
      >
        −15 s
      </button>
      <button
        onClick={() => onChange(endsAt + 15_000)}
        className="rounded-lg bg-white/15 px-3 py-1 text-sm"
      >
        +15 s
      </button>
      <button
        onClick={() => onChange(null)}
        className="rounded-lg bg-white/15 px-3 py-1 text-sm"
      >
        Weiter
      </button>
    </div>
  );
}
