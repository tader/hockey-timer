export interface PeriodConfig {
  periodCount: number;
  periodDurationSeconds: number[];
}

export interface SplitDuration {
  minutes: number;
  seconds: number;
}

export function parsePeriodConfig(
  periodCountRaw: string,
  periodMinutesRaw: string,
  periodSecondsRaw?: string,
): PeriodConfig;

export function splitDuration(totalSeconds: number): SplitDuration;
