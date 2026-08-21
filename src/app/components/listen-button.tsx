"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { collectBlocks, splitSentences } from "@/lib/tts";

type Chunk = { text: string; block: HTMLElement; offset: number };
type Status = "idle" | "playing" | "paused";

const RATES = [1, 1.25, 1.5, 0.75];
/** Class added to the block being spoken; styled in globals.css. */
const READING = "tts-reading";

export function ListenButton({ title, minutes }: { title: string; minutes: number }) {
  // Capability check that survives SSR: the server snapshot is always false, so
  // the markup matches until the client says otherwise.
  const supported = useSyncExternalStore(subscribeNothing, hasSpeech, () => false);
  const [status, setStatus] = useState<Status>("idle");
  const [rate, setRate] = useState(1);
  const [percent, setPercent] = useState(0);

  const chunks = useRef<Chunk[] | null>(null);
  const total = useRef(1);
  const index = useRef(0);
  const rateRef = useRef(1);
  // Bumped on every stop/restart. A cancelled utterance still fires `onend`,
  // and without this the stale callback would queue the next chunk.
  const session = useRef(0);

  const clearHighlight = useCallback(() => {
    for (const element of document.querySelectorAll(`.${READING}`)) {
      element.classList.remove(READING);
    }
  }, []);

  // Stop speaking if the reader leaves: the utterance queue lives on the
  // browser, not in React, so it would otherwise keep going without the page.
  useEffect(() => {
    return () => {
      session.current += 1;
      window.speechSynthesis.cancel();
      clearHighlight();
    };
  }, [clearHighlight]);

  /**
   * Read the rendered article into utterance-sized chunks. Deferred until the
   * reader actually presses play, so the DOM is settled and nothing is parsed
   * for the many visitors who never listen.
   */
  const collect = useCallback((): Chunk[] => {
    if (chunks.current) return chunks.current;

    const article = document.querySelector("main article");
    const body = article?.querySelector(".prose");
    const collected: Chunk[] = [];
    let offset = 0;

    const push = (text: string, block: HTMLElement) => {
      for (const sentence of splitSentences(text)) {
        collected.push({ text: sentence, block, offset });
        offset += sentence.length;
      }
    };

    const heading = article?.querySelector("h1");
    if (heading) push(title, heading);
    if (body) for (const block of collectBlocks(body)) push(block.textContent ?? "", block);

    total.current = Math.max(1, offset);
    chunks.current = collected;
    return collected;
  }, [title]);

  /** Keep the spoken block in sight, but never yank a reader who can see it. */
  const reveal = useCallback((block: HTMLElement) => {
    const { top, bottom } = block.getBoundingClientRect();
    if (top >= 0 && bottom <= window.innerHeight) return;
    block.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const speakFrom = useCallback(
    (start: number) => {
      const synthesis = window.speechSynthesis;
      session.current += 1;
      const token = session.current;
      synthesis.cancel();

      const queue = collect();
      const speak = (position: number) => {
        const chunk = queue[position];
        if (!chunk) {
          clearHighlight();
          setStatus("idle");
          index.current = 0;
          setPercent(0);
          return;
        }

        const utterance = new SpeechSynthesisUtterance(chunk.text);
        utterance.rate = rateRef.current;
        utterance.lang = document.documentElement.lang || "en";
        const voice = pickVoice();
        if (voice) utterance.voice = voice;

        utterance.onstart = () => {
          if (token !== session.current) return;
          index.current = position;
          setPercent(Math.min(100, Math.round((chunk.offset / total.current) * 100)));
          clearHighlight();
          chunk.block.classList.add(READING);
          reveal(chunk.block);
        };
        utterance.onend = () => {
          if (token !== session.current) return;
          speak(position + 1);
        };
        utterance.onerror = (event) => {
          if (token !== session.current) return;
          // "interrupted"/"canceled" are our own cancel() landing late.
          if (event.error === "interrupted" || event.error === "canceled") return;
          clearHighlight();
          setStatus("idle");
        };

        synthesis.speak(utterance);
      };

      speak(start);
    },
    [clearHighlight, collect, reveal],
  );

  // iOS only honours speak() inside the gesture that triggered it, so this
  // handler must stay synchronous — no awaiting voices before starting.
  const play = useCallback(() => {
    if (collect().length === 0) return;
    setStatus("playing");
    speakFrom(index.current);
  }, [collect, speakFrom]);

  const pause = useCallback(() => {
    window.speechSynthesis.pause();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    window.speechSynthesis.resume();
    setStatus("playing");
  }, []);

  const stop = useCallback(() => {
    session.current += 1;
    window.speechSynthesis.cancel();
    clearHighlight();
    index.current = 0;
    setPercent(0);
    setStatus("idle");
  }, [clearHighlight]);

  const cycleRate = useCallback(() => {
    const next = RATES[(RATES.indexOf(rateRef.current) + 1) % RATES.length];
    rateRef.current = next;
    setRate(next);
    // A rate change only reaches the next utterance, so restart this sentence.
    if (status === "playing") speakFrom(index.current);
  }, [speakFrom, status]);

  // Nothing to offer a browser without speech synthesis; render nothing at all.
  if (!supported) return null;

  if (status === "idle") {
    return (
      <button type="button" onClick={play} className={SHELL} aria-label={`Listen to ${title}`}>
        <PlayIcon />
        Listen
        {minutes > 0 && <span className="text-zinc-400 dark:text-zinc-500">· {minutes} min</span>}
      </button>
    );
  }

  return (
    <div className={SHELL}>
      <button
        type="button"
        onClick={status === "playing" ? pause : resume}
        aria-label={status === "playing" ? "Pause" : "Resume"}
        className={CONTROL}
      >
        {status === "playing" ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div
        role="progressbar"
        aria-label="Listening progress"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1 w-20 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
      >
        <div
          className="h-full rounded-full bg-zinc-500 transition-[width] duration-300 dark:bg-zinc-400"
          style={{ width: `${percent}%` }}
        />
      </div>

      <button
        type="button"
        onClick={cycleRate}
        aria-label={`Speed ${rate}×, change`}
        className={`${CONTROL} tabular-nums`}
      >
        {rate}×
      </button>

      <button type="button" onClick={stop} aria-label="Stop" className={CONTROL}>
        <StopIcon />
      </button>
    </div>
  );
}

function subscribeNothing() {
  return () => {};
}

function hasSpeech() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Prefer a natural-sounding local English voice, else whatever the browser has. */
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  const english = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  const pool = english.length > 0 ? english : voices;
  return pool.find((voice) => voice.localService && voice.default) ?? pool[0] ?? null;
}

const SHELL =
  "inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1.5 text-sm " +
  "text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-900 " +
  "dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-white";

const CONTROL =
  "flex items-center justify-center rounded-full text-zinc-500 transition-colors " +
  "hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white";

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M5 3.5v9l7.5-4.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M5 3.5h2.2v9H5zM8.8 3.5H11v9H8.8z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <rect x="4" y="4" width="8" height="8" rx="1.2" />
    </svg>
  );
}
