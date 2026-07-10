import { useEffect, useRef, useCallback } from "react";
import { getOrgSettings, ORG_UPDATE_EVENT } from "../utils/orgSettings";

const MAX_WARN_SECONDS = 60;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
const LAST_PATH_KEY = "session_last_path";

export function saveLastPath() {
  const p = window.location.pathname + window.location.search;
  if (p && p !== "/login" && p !== "/") {
    sessionStorage.setItem(LAST_PATH_KEY, p);
  }
}

export function popLastPath(): string | null {
  return sessionStorage.getItem(LAST_PATH_KEY);
}

interface Options {
  onWarn: (secondsLeft: number, totalWarnSeconds: number) => void;
  onExpire: () => void;
  onReset: () => void;
}

export function useSessionTimeout({ onWarn, onExpire, onReset }: Options) {
  // Use refs so callbacks are always current without re-triggering effects
  const onWarnRef   = useRef(onWarn);
  const onExpireRef = useRef(onExpire);
  const onResetRef  = useRef(onReset);
  useEffect(() => { onWarnRef.current   = onWarn;   }, [onWarn]);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);
  useEffect(() => { onResetRef.current  = onReset;  }, [onReset]);

  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningRef  = useRef(false);
  const warnSecsRef = useRef(MAX_WARN_SECONDS); // total warn window for current schedule

  const clearAll = useCallback(() => {
    if (timerRef.current)  { clearTimeout(timerRef.current);   timerRef.current  = null; }
    if (warnRef.current)   { clearTimeout(warnRef.current);    warnRef.current   = null; }
    if (countRef.current)  { clearInterval(countRef.current);  countRef.current  = null; }
  }, []);

  const schedule = useCallback(() => {
    clearAll();
    warningRef.current = false;

    const mins    = getOrgSettings().session_timeout_minutes ?? 30;
    const totalMs = Math.max(1, mins) * 60 * 1000;
    const warnSec = Math.min(MAX_WARN_SECONDS, Math.floor(totalMs / 2000));
    const warnAt  = totalMs - warnSec * 1000;

    warnSecsRef.current = warnSec;

    // Fire warning countdown
    if (warnSec > 0 && warnAt > 0) {
      warnRef.current = setTimeout(() => {
        warningRef.current = true;
        let secs = warnSec;
        onWarnRef.current(secs, warnSec);

        // Tick every second
        countRef.current = setInterval(() => {
          secs -= 1;
          if (secs <= 0) {
            clearInterval(countRef.current!);
            countRef.current = null;
          } else {
            onWarnRef.current(secs, warnSec);
          }
        }, 1000);
      }, warnAt);
    }

    // Hard expiry
    timerRef.current = setTimeout(() => {
      clearAll();
      saveLastPath();
      onExpireRef.current();
    }, totalMs);
  }, [clearAll]);

  const reset = useCallback(() => {
    warningRef.current = false;
    onResetRef.current();
    schedule();
  }, [schedule]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    schedule();

    // Activity resets timer only when NOT in warning mode
    const onActivity = () => {
      if (!warningRef.current) schedule();
    };

    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }));

    // Restart when admin changes timeout in Configurations
    const onOrgUpdate = () => schedule();
    window.addEventListener(ORG_UPDATE_EVENT, onOrgUpdate);

    return () => {
      clearAll();
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, onActivity));
      window.removeEventListener(ORG_UPDATE_EVENT, onOrgUpdate);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once — schedule/clearAll are stable refs

  return { reset };
}
