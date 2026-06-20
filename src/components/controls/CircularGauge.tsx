import { useEffect, useRef } from "react";
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
const SIZE = 156;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;

// polar -> svg cartesian
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function describeArc(start: number, end: number) {
  const p1 = polar(CENTER, CENTER, RADIUS, start);
  const p2 = polar(CENTER, CENTER, RADIUS, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${p2.x} ${p2.y}`;
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
  valueRef.current = value;

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const ratio = (clamp(value) - min) / (max - min);
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
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90; // shift so 0deg = top
    if (deg > 180) deg -= 360;
    if (deg < -180) deg += 360;
    // snap to ARC range
    let local = deg - ARC_START;
    if (local < 0) local = 0;
    if (local > ARC_RANGE) local = ARC_RANGE;
    return local;
  };

  const commit = (local: number) => {
    const raw = min + (local / ARC_RANGE) * (max - min);
    const snapped = Math.round(raw / step) * step;
    const next = clamp(Number(snapped.toFixed(2)));
    if (next !== valueRef.current) onChange(next);
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    draggingRef.current = true;
    svgRef.current?.setPointerCapture(e.pointerId);
    const local = angleFromEvent(e);
    if (local != null) commit(local);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    const local = angleFromEvent(e);
    if (local != null) commit(local);
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    draggingRef.current = false;
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  // Keyboard support
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

  return (
    <div className={`circ-gauge ${on ? "is-on" : "is-off"}`} data-mode={mode}>
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
        aria-valuenow={value}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <linearGradient id="cg-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={tone.ring} stopOpacity="0.95" />
            <stop offset="100%" stopColor={tone.ring} stopOpacity="0.55" />
          </linearGradient>
          <filter id="cg-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track */}
        <path
          d={describeArc(ARC_START, ARC_START + ARC_RANGE)}
          stroke="rgba(60,46,110,0.10)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
        />
        {/* Tick marks */}
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
        {/* Progress arc */}
        <path
          d={describeArc(ARC_START, arcEnd)}
          stroke="url(#cg-grad)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          filter={on ? "url(#cg-glow)" : undefined}
          style={{ transition: "all 240ms cubic-bezier(0.2,0.8,0.2,1)" }}
        />
        {/* Knob */}
        <g style={{ transition: "transform 240ms cubic-bezier(0.2,0.8,0.2,1)" }}>
          <circle cx={knob.x} cy={knob.y} r={12} fill="#fff" stroke={tone.ring} strokeWidth={3} />
          <circle cx={knob.x} cy={knob.y} r={4} fill={tone.ring} />
        </g>
      </svg>
      <div className="circ-gauge__center" aria-hidden>
        <span className="circ-gauge__value">
          {Number.isInteger(value) ? value : value.toFixed(1)}
          <em>{unit}</em>
        </span>
        <span className="circ-gauge__label">{tone.label} · {on ? "Running" : "Standby"}</span>
      </div>
    </div>
  );
}
