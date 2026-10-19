import { useCallback, useEffect, useRef, useState } from 'react';

// Countdown used to throttle "resend code" buttons.
export default function useCooldown(seconds = 30) {
  const [remaining, setRemaining] = useState(0);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  const start = useCallback(() => {
    clearInterval(timer.current);
    setRemaining(seconds);
    timer.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(timer.current); return 0; }
        return r - 1;
      });
    }, 1000);
  }, [seconds]);

  return [remaining, start];
}
