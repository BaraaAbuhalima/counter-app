"use client";
import { useEffect, useState } from "react";

type Counters = { video: number; photo: number };

export default function Home() {
  const [counters, setCounters] = useState<Counters>({ video: 0, photo: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    const fetchCounters = async () => {
      try {
        const res = await fetch("/api/counter", { signal: controller.signal });
        const data = await res.json();
        if (mounted && data) {
          setCounters({
            video: Number(data.video ?? 0),
            photo: Number(data.photo ?? 0),
          });
        }
      } catch (err) {
        const name = (err as { name?: string }).name;
        if (name === "AbortError") return;
        console.error("Failed to fetch counters", err);
      }
    };

    fetchCounters();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const updateCounter = async (key: "video" | "photo", delta: number) => {
    setLoading(true);
    try {
      const res = await fetch("/api/counter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, delta }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Update failed", data);
        alert(data?.error ?? "Update failed");
        return;
      }

      // If the API indicates the update was not persisted to disk, warn the user
      if (data?._persisted === false) {
        alert(
          "Updated in memory but failed to persist to disk in this environment."
        );
      }

      setCounters({
        video: Number(data.video ?? counters.video),
        photo: Number(data.photo ?? counters.photo),
      });
    } catch (err) {
      console.error("Update error", err);
      alert("Update error. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <div className="container">
        <section className="counter-card">
          <div className="counter-title">Video</div>
          <div className="counter-value">{counters.video}</div>
          <div className="controls">
            <button
              className="btn"
              aria-label="Increase video counter"
              onClick={() => updateCounter("video", 1)}
              disabled={loading}
            >
              +
            </button>
            <button
              className="btn secondary"
              aria-label="Decrease video counter"
              onClick={() => updateCounter("video", -1)}
              disabled={loading}
            >
              -
            </button>
          </div>
        </section>

        <section className="counter-card">
          <div className="counter-title">Photo</div>
          <div className="counter-value">{counters.photo}</div>
          <div className="controls">
            <button
              className="btn"
              aria-label="Increase photo counter"
              onClick={() => updateCounter("photo", 1)}
              disabled={loading}
            >
              +
            </button>
            <button
              className="btn secondary"
              aria-label="Decrease photo counter"
              onClick={() => updateCounter("photo", -1)}
              disabled={loading}
            >
              -
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
