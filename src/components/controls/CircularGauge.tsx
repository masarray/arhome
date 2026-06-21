import { useEffect, useId, useRef, useState } from "react";
import type { DeviceMode } from "@/domain/smartHomeTypes";

type CircularGaugeProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  unit: string;
  mode?: DeviceMode;
  on: boolean;
  onChange: (next: number) => void;
};

const ARC_RANGE = 260; // degrees swept
const ARC_START = -130; // start angle (deg from 12 o'clock)
const TRACK_SIZE = 156;
const SVG_PADDING = 18;
const SIZE = TRACK_SIZE + SVG_PADDING * 2;
const STROKE = 12;
const RADIUS = (TRACK_SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const HIT_INNER = RADIUS - 40;
const HIT_OUTER = RADIUS + 34;

// polar -> svg cartesian
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function describeArc(start: number, end: number) {
  const safeEnd = Math.max(start + 0.01, end);
  const p1 = polar(CENTER, CENTER, RADIUS, start);
  const p2 = polar(CENTER, CENTER, RADIUS, safeEnd);
  const large = safeEnd - start > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${p2.x} ${p2.y}`;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function formatReadout(value: number) {
  return value.toFixed(1).padStart(4, "0");
}

const MODE_TONE: Record<string, { bg: string; ring: string; label: string }> = {
  cool: { bg: "#dff3ff", ring: "#3aa6ff", label: "Cool" },
  heat: { bg: "#ffe3d8", ring: "#ff7a4a", label: "Heat" },
  dry: { bg: "#fff4d8", ring: "#f0b03c", label: "Dry" },
  fan: { bg: "#e6f7ee", ring: "#33b27e", label: "Fan" },
  auto: { bg: "#ecebff", ring: "#7c6bff", label: "Auto" },
};

export function CircularGauge({
  value,
  min,
  max,
  step = 0.5,
  label,
  unit,
  mode = "cool",
  on,
  onChange,
}: CircularGaugeProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);
  const valueRef = useRef(value);
  const readoutRef = useRef(value);
  const [draftValue, setDraftValue] = useState(value);
  const [dragging, setDragging] = useState(false);
  const [readoutValue, setReadoutValue] = useState(value);
  const idBase = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gradId = `cg-grad-${idBase}`;
  const glowId = `cg-glow-${idBase}`;

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const displayValue = clamp(draggingRef.current ? draftValue : value);
  valueRef.current = displayValue;

  useEffect(() => {
    if (!draggingRef.current) setDraftValue(value);
  }, [value]);

  useEffect(() => {
    const from = readoutRef.current;
    const to = displayValue;
    if (Math.abs(from - to) < 0.01) {
      readoutRef.current = to;
      setReadoutValue(to);
      return;
    }

    let frame = 0;
    const duration = dragging ? 90 : 180;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const next = from + (to - from) * easeOutCubic(progress);
      readoutRef.current = next;
      setReadoutValue(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [displayValue, dragging]);

  const ratio = (displayValue - min) / (max - min);
  const tone = MODE_TONE[mode] ?? MODE_TONE.cool;
  const arcEnd = ARC_START + ratio * ARC_RANGE;
  const knob = polar(CENTER, CENTER, RADIUS, arcEnd);

  const angleFromEvent = (e: PointerEvent | React.PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const distance = Math.hypot(dx, dy);

    // Only the gauge ring is interactive. This prevents the oversized SVG glow area
    // from stealing clicks from the AC mode buttons below the gauge.
    if (distance < HIT_INNER || distance > HIT_OUTER) return null;

    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90; // shift so 0deg = top
    if (deg > 180) deg -= 360;
    if (deg < -180) deg += 360;
    let local = deg - ARC_START;
    if (local < 0) local = 0;
    if (local > ARC_RANGE) local = ARC_RANGE;
    return local;
  };

  const commit = (local: number) => {
    const raw = min + (local / ARC_RANGE) * (max - min);
    const snapped = Math.round(raw / step) * step;
    const next = clamp(Number(snapped.toFixed(2)));
    setDraftValue(next);
    if (next !== valueRef.current) onChange(next);
    valueRef.current = next;
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const local = angleFromEvent(e);
    if (local == null) return;
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    setDragging(true);
    svgRef.current?.setPointerCapture(e.pointerId);
    commit(local);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    const local = angleFromEvent(e);
    if (local != null) commit(local);
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    draggingRef.current = false;
    setDragging(false);
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const node = svgRef.current;
    if (!node) return;
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement !== node) return;
      if (e.key === "ArrowUp" || e.key === "ArrowRight") {
        e.preventDefault();
        onChange(clamp(value + step));
      } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
        e.preventDefault();
        onChange(clamp(value - step));
      }
    };
    node.addEventListener("keydown", handler);
    return () => node.removeEventListener("keydown", handler);
  }, [value, step, min, max, onChange]);

  const readoutText = formatReadout(clamp(readoutValue));

  return (
    <div className={`circ-gauge ${on ? "is-on" : "is-off"} ${dragging ? "is-dragging" : ""}`} data-mode={mode}>
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="circ-gauge__svg"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={displayValue}
        aria-valuetext={`${readoutText}${unit}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={tone.ring} stopOpacity="0.95" />
            <stop offset="100%" stopColor={tone.ring} stopOpacity="0.55" />
          </linearGradient>
          <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%" filterUnits="objectBoundingBox">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d={describeArc(ARC_START, ARC_START + ARC_RANGE)}
          stroke="rgba(60,46,110,0.10)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
        />
        {Array.from({ length: 27 }).map((_, i) => {
          const a = ARC_START + (i / 26) * ARC_RANGE;
          const inner = polar(CENTER, CENTER, RADIUS - STROKE / 2 - 4, a);
          const outer = polar(CENTER, CENTER, RADIUS - STROKE / 2 - (i % 5 === 0 ? 12 : 8), a);
          return (
            <line
              key={i}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke="rgba(60,46,110,0.18)"
              strokeWidth={i % 5 === 0 ? 1.6 : 1}
            />
          );
        })}
        <path
          className="circ-gauge__progress"
          d={describeArc(ARC_START, arcEnd)}
          stroke={`url(#${gradId})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          filter={on ? `url(#${glowId})` : undefined}
        />
        <g className="circ-gauge__knob">
          <circle cx={knob.x} cy={knob.y} r={12} fill="#fff" stroke={tone.ring} strokeWidth={3} />
          <circle cx={knob.x} cy={knob.y} r={4} fill={tone.ring} />
        </g>
      </svg>
      <div className="circ-gauge__center" aria-hidden>
        <span className="circ-gauge__value">
          <span className="circ-gauge__number">{readoutText}</span>
          <em>{unit}</em>
        </span>
        <span className="circ-gauge__label">{tone.label} · {on ? "Running" : "Standby"}</span>
      </div>
    </div>
  );
}
