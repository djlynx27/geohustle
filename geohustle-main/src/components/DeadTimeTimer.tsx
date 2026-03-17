import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Timer, Pause } from 'lucide-react';

const LS_KEY = 'geohustle_dead_time';

interface DeadTimeState {
  startedAt: number | null;
  accumulated: number; // ms accumulated before current session
  paused: boolean;
}

function loadState(): DeadTimeState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { startedAt: Date.now(), accumulated: 0, paused: false };
}

function saveState(s: DeadTimeState) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

interface Props {
  nearestZoneName?: string | null;
}

export function DeadTimeTimer({ nearestZoneName }: Props) {
  const [state, setState] = useState<DeadTimeState>(loadState);
  const [elapsed, setElapsed] = useState(0);

  // Listen for trip start/end events
  useEffect(() => {
    function onTripStart() {
      setState(prev => {
        const now = Date.now();
        const totalAccum = prev.accumulated + (prev.startedAt && !prev.paused ? now - prev.startedAt : 0);
        const next = { startedAt: null, accumulated: totalAccum, paused: true };
        saveState(next);
        return next;
      });
    }
    function onTripEnd() {
      setState(() => {
        const next: DeadTimeState = { startedAt: Date.now(), accumulated: 0, paused: false };
        saveState(next);
        return next;
      });
    }
    window.addEventListener('trip-start', onTripStart);
    window.addEventListener('trip-end', onTripEnd);
    return () => {
      window.removeEventListener('trip-start', onTripStart);
      window.removeEventListener('trip-end', onTripEnd);
    };
  }, []);

  // Tick every second
  useEffect(() => {
    if (state.paused) {
      setElapsed(state.accumulated);
      return;
    }
    const tick = () => {
      const now = Date.now();
      const total = state.accumulated + (state.startedAt ? now - state.startedAt : 0);
      setElapsed(total);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state]);

  const seconds = Math.floor(elapsed / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const isWarning = mins >= 10;

  return (
    <div className={`rounded-xl border px-4 py-3 ${
      state.paused
        ? 'bg-muted/30 border-border'
        : isWarning
          ? 'bg-yellow-500/15 border-yellow-500/40'
          : 'bg-card border-border'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {state.paused ? (
            <Pause className="w-4 h-4 text-muted-foreground" />
          ) : isWarning ? (
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
          ) : (
            <Timer className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-[14px] font-body text-muted-foreground">
            {state.paused ? 'Temps mort (en pause)' : 'Temps mort'}
          </span>
        </div>
        <span className={`text-[24px] font-display font-bold tabular-nums ${
          isWarning && !state.paused ? 'text-yellow-500' : 'text-foreground'
        }`}>
          {display}
        </span>
      </div>
      {isWarning && !state.paused && nearestZoneName && (
        <p className="text-[13px] text-yellow-500 font-body mt-1">
          ⚠️ +10 min d'inactivité — Dirigez-vous vers {nearestZoneName}
        </p>
      )}
    </div>
  );
}
