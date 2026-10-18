"use client";

// Drop cached pages on logout so the next person on a shared device can't open them offline.
export function LogoutButton() {
  return (
    <button
      className="underline"
      onClick={() => {
        navigator.serviceWorker?.controller?.postMessage("clear-pages");
      }}
    >
      Ausloggen
    </button>
  );
}
