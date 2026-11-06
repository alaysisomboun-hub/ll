import { useEffect, useRef, useState, useCallback } from 'react';

export interface HardwareScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  minChars?: number;
  maxIntervalMs?: number;
  duplicateTimeoutMs?: number;
}

export interface HardwareScannerState {
  isListening: boolean;
  lastScannedCode: string;
  lastScannedAt: number | null;
  scanCount: number;
  recentIntervalAvgMs: number;
}

/**
 * Custom Hook for USB, Bluetooth, and 2.4G Wireless Barcode Scanners (HID Keyboard Emulation)
 *
 * Hardware barcode scanners emit keystrokes at very high speed (typically 5ms - 40ms per key)
 * terminated by an 'Enter' key.
 *
 * This hook captures these bursts globally across the page, avoiding interference with
 * deliberate manual user typing, while preventing duplicate triggers and ensuring instant
 * product lookup and cart addition.
 */
export function useHardwareBarcodeScanner({
  onScan,
  enabled = true,
  minChars = 3,
  maxIntervalMs = 70, // Max ms between keystrokes to qualify as hardware scanner
  duplicateTimeoutMs = 800, // Prevent accidental double-reads of the same barcode
}: HardwareScannerOptions): HardwareScannerState {
  const [lastScannedCode, setLastScannedCode] = useState<string>('');
  const [lastScannedAt, setLastScannedAt] = useState<number | null>(null);
  const [scanCount, setScanCount] = useState<number>(0);
  const [recentIntervalAvgMs, setRecentIntervalAvgMs] = useState<number>(0);

  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const intervalsRef = useRef<number[]>([]);
  const lastProcessedBarcodeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  const handleBarcodeReceived = useCallback(
    (code: string) => {
      const now = Date.now();
      const last = lastProcessedBarcodeRef.current;

      // Duplicate prevention: if the exact same barcode is read within duplicateTimeoutMs, ignore
      if (last.code === code && now - last.time < duplicateTimeoutMs) {
        return;
      }

      lastProcessedBarcodeRef.current = { code, time: now };
      setLastScannedCode(code);
      setLastScannedAt(now);
      setScanCount((prev) => prev + 1);

      if (intervalsRef.current.length > 0) {
        const avg =
          intervalsRef.current.reduce((a, b) => a + b, 0) / intervalsRef.current.length;
        setRecentIntervalAvgMs(Math.round(avg));
      }

      onScan(code);
    },
    [onScan, duplicateTimeoutMs]
  );

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore functional control keys
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      const now = performance.now();
      const interval = now - (lastKeyTimeRef.current || now);
      lastKeyTimeRef.current = now;

      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // Handle Enter / Return key (standard terminator for barcode scanners)
      if (e.key === 'Enter') {
        const candidate = bufferRef.current.trim();
        const intervals = intervalsRef.current;
        const avgInterval =
          intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 999;

        // Reset buffers
        bufferRef.current = '';
        intervalsRef.current = [];

        // Check if the burst matches a hardware scanner pattern:
        // 1) Length meets minimum barcode characters
        // 2) Average key interval is fast (< maxIntervalMs) OR input is focused in a barcode-ready field
        const isFastBurst = candidate.length >= minChars && avgInterval < maxIntervalMs;

        if (isFastBurst) {
          // Prevent default if it wasn't a standard form submit
          if (!isInput) {
            e.preventDefault();
            e.stopPropagation();
          }
          handleBarcodeReceived(candidate);
          return;
        }

        // If the user was in an input and typed manually, let standard form submit handle it
        return;
      }

      // Check if key is a single printable character
      if (e.key.length === 1) {
        // If the time since last key is too long and we aren't in active scanner burst, reset buffer
        if (interval > maxIntervalMs * 2.5) {
          bufferRef.current = '';
          intervalsRef.current = [];
        }

        bufferRef.current += e.key;
        if (bufferRef.current.length > 1) {
          intervalsRef.current.push(interval);
        }

        // Safety limit to avoid unbounded buffer growth
        if (bufferRef.current.length > 80) {
          bufferRef.current = bufferRef.current.slice(-50);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, minChars, maxIntervalMs, handleBarcodeReceived]);

  return {
    isListening: enabled,
    lastScannedCode,
    lastScannedAt,
    scanCount,
    recentIntervalAvgMs,
  };
}
