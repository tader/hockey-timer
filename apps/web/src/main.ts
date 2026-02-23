const API_BASE = (globalThis as { __API_BASE__?: string }).__API_BASE__ ?? "http://localhost:8787";
const matchId = "demo-match";

const deviceIdKey = "hockey_timer_device_id";
const sequenceKey = "hockey_timer_sequence";

function getDeviceId(): string {
  const current = localStorage.getItem(deviceIdKey);
  if (current) return current;
  const created = crypto.randomUUID();
  localStorage.setItem(deviceIdKey, created);
  return created;
}

function nextSequence(): number {
  const current = Number(localStorage.getItem(sequenceKey) ?? "0");
  const next = Number.isFinite(current) ? current + 1 : 1;
  localStorage.setItem(sequenceKey, String(next));
  return next;
}

async function pushEvent(eventType: string, payload: object): Promise<void> {
  const event = {
    eventId: crypto.randomUUID(),
    matchId,
    eventType,
    occurredAt: new Date().toISOString(),
    originDeviceId: getDeviceId(),
    originPlatform: "web",
    sequence: nextSequence(),
    payload,
    version: 1,
  };

  const response = await fetch(`${API_BASE}/matches/${matchId}/events:batchUpsert`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events: [event] }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`upsert failed: ${response.status} ${text}`);
  }
}

type Projection = {
  homeScore: number;
  awayScore: number;
  isRunning: boolean;
  isEnded: boolean;
  currentPeriod: number;
  playedSeconds: number;
  totalPlayedSeconds: number;
  currentPeriodPlayedSeconds: number;
  format: {
    periodCount: number;
    periodDurationSeconds: number[];
  };
  lastEventAt?: string;
};

async function fetchProjection(): Promise<Projection> {
  const response = await fetch(`${API_BASE}/matches/${matchId}/projection`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`projection fetch failed: ${response.status} ${text}`);
  }
  return response.json() as Promise<Projection>;
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function periodTimerDisplay(projection: Projection): { label: string; isOverrun: boolean } {
  const periodIndex = Math.max(0, projection.currentPeriod - 1);
  const configured = projection.format.periodDurationSeconds[periodIndex] ?? 0;
  const remaining = configured - projection.currentPeriodPlayedSeconds;

  if (remaining >= 0) {
    return { label: `${formatClock(remaining)} remaining`, isOverrun: false };
  }

  return { label: `+${formatClock(Math.abs(remaining))} over`, isOverrun: true };
}

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("missing #app");
}

root.innerHTML = `
  <h1>Hockey Timer Web MVP</h1>
  <p>Public match view with RO default join and optional later sign-in.</p>
  <section>
    <h2>Live Match</h2>
    <div class="card">
      <p>Match: <strong>${matchId}</strong></p>
      <p id="score">Score: <strong>Home 0 - 0 Away</strong></p>
      <p id="state">State: <strong>PAUSED</strong></p>
      <p id="period">Period: <strong>P1</strong></p>
      <p id="clock">Time: <strong>17:30 remaining</strong></p>
      <div class="row">
        <button id="start">Start</button>
        <button id="pause">Pause</button>
        <button id="resume">Resume</button>
        <button id="endPeriod">End Period</button>
        <button id="endMatch">End Match</button>
      </div>
      <div class="row">
        <button id="homePlus">+ Home</button>
        <button id="awayPlus">+ Away</button>
        <button id="homeMinus">- Home</button>
        <button id="awayMinus">- Away</button>
      </div>
      <div class="row">
        <button id="poll">Poll Now</button>
      </div>
      <pre id="output">Ready.</pre>
    </div>
  </section>
`;

const output = document.querySelector<HTMLElement>("#output");
const score = document.querySelector<HTMLElement>("#score");
const state = document.querySelector<HTMLElement>("#state");
const period = document.querySelector<HTMLElement>("#period");
const clock = document.querySelector<HTMLElement>("#clock");

function setOutput(text: string): void {
  if (output) output.textContent = text;
}

async function refreshProjection(): Promise<void> {
  try {
    const projection = await fetchProjection();
    if (score) score.innerHTML = `Score: <strong>Home ${projection.homeScore} - ${projection.awayScore} Away</strong>`;
    const stateLabel = projection.isEnded ? "ENDED" : projection.isRunning ? "RUNNING" : "PAUSED";
    if (state) state.innerHTML = `State: <strong>${stateLabel}</strong>`;
    if (period) period.innerHTML = `Period: <strong>P${projection.currentPeriod}</strong>`;
    const timer = periodTimerDisplay(projection);
    if (clock) {
      clock.innerHTML = `Time: <strong class="${timer.isOverrun ? "overrun" : ""}">${timer.label}</strong>`;
    }
    setOutput(`Last update: ${new Date().toLocaleTimeString()} (event: ${projection.lastEventAt ?? "none"})`);
  } catch (error) {
    setOutput((error as Error).message);
  }
}

function wireAction(selector: string, action: () => Promise<void>): void {
  const element = document.querySelector<HTMLButtonElement>(selector);
  element?.addEventListener("click", async () => {
    try {
      await action();
      await refreshProjection();
    } catch (error) {
      setOutput((error as Error).message);
    }
  });
}

wireAction("#start", () => pushEvent("match.started", {}));
wireAction("#pause", () => pushEvent("match.paused", {}));
wireAction("#resume", () => pushEvent("match.resumed", {}));
wireAction("#endPeriod", () => pushEvent("period.ended", {}));
wireAction("#endMatch", () => pushEvent("match.ended", {}));
wireAction("#homePlus", () => pushEvent("score.changed", { team: "home", delta: 1, reason: "goal" }));
wireAction("#awayPlus", () => pushEvent("score.changed", { team: "away", delta: 1, reason: "goal" }));
wireAction("#homeMinus", () => pushEvent("score.changed", { team: "home", delta: -1, reason: "correction" }));
wireAction("#awayMinus", () => pushEvent("score.changed", { team: "away", delta: -1, reason: "correction" }));
wireAction("#poll", refreshProjection);

void refreshProjection();
setInterval(() => {
  void refreshProjection();
}, 3000);
