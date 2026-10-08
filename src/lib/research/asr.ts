/**
 * Fixture ASR parser. Production swap: faster-whisper on earnings-call audio
 * (see ingestion/asr.py). This environment has no call recordings, so we
 * parse the timestamped MAEC-style transcript fixture instead of inventing
 * words the model did not hear.
 */
export type Utterance = {
  timestamp: string;
  speaker: string;
  text: string;
  charStart: number;
  charEnd: number;
};

const LINE_RE = /\[(\d{2}:\d{2}:\d{2})\]\s+([^:]{2,80}):\s+(.+)/g;

export function parseTimestampedTranscript(raw: string): Utterance[] {
  const utterances: Utterance[] = [];
  for (const m of raw.matchAll(LINE_RE)) {
    if (m.index === undefined) continue;
    const text = m[3].trim();
    utterances.push({
      timestamp: m[1],
      speaker: m[2].trim(),
      text,
      charStart: m.index,
      charEnd: m.index + m[0].length,
    });
  }
  return utterances;
}

export function hedgeRate(text: string): { count: number; rate: number; tokens: string[] } {
  const hedge =
    /\b(believe|approximately|cautious|uneven|challenging|not providing|visibility|early innings|we think|near term|mixed)\b/gi;
  const words = text.split(/\s+/).filter(Boolean);
  const tokens = [...text.matchAll(hedge)].map((m) => m[0].toLowerCase());
  return { count: tokens.length, rate: tokens.length / Math.max(words.length, 1), tokens: [...new Set(tokens)] };
}
