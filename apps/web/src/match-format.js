export function parsePeriodConfig(periodCountRaw, periodMinutesRaw, periodSecondsRaw = "0") {
  const parsedCount = Number(periodCountRaw);
  const parsedMinutes = Number(periodMinutesRaw);
  const parsedSeconds = Number(periodSecondsRaw);
  const periodCount = Math.max(1, Math.min(12, Number.isFinite(parsedCount) ? Math.round(parsedCount) : 4));
  const minutes = Math.max(0, Math.min(180, Number.isFinite(parsedMinutes) ? Math.floor(parsedMinutes) : 17));
  const seconds = Math.max(0, Math.min(59, Number.isFinite(parsedSeconds) ? Math.floor(parsedSeconds) : 30));
  const durationSeconds = Math.max(1, minutes * 60 + seconds);
  return {
    periodCount,
    periodDurationSeconds: Array.from({ length: periodCount }, () => durationSeconds),
  };
}

export function splitDuration(totalSeconds) {
  const parsed = Number(totalSeconds);
  const safe = Math.max(1, Number.isFinite(parsed) ? Math.round(parsed) : 17 * 60 + 30);
  return {
    minutes: Math.floor(safe / 60),
    seconds: safe % 60,
  };
}
