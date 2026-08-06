"use client";

import { useEffect, useState } from "react";
import { SENSORS, type SensorSeries } from "@/lib/mock-data";

function Sparkline({ trend, max }: { trend: number[]; max: number }) {
  const width = 96;
  const height = 26;
  const points = trend
    .map((value, index) => {
      const x = (index / (trend.length - 1)) * width;
      const y = height - (value / max) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      <polygon points={areaPoints} fill="rgba(196,167,108,0.08)" />
      <polyline
        points={points}
        fill="none"
        stroke="rgba(196,167,108,0.75)"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatValue(sensor: SensorSeries): string {
  const decimals = sensor.decimals ?? (Number.isInteger(sensor.value) ? 0 : 1);
  return sensor.value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function useLiveSensors(seed: SensorSeries[], intervalMs = 2400): SensorSeries[] {
  const [sensors, setSensors] = useState(seed);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(() => {
      setSensors((previous) =>
        previous.map((sensor) => {
          const last = sensor.trend[sensor.trend.length - 1];
          const step =
            sensor.id === "ar"
              ? 3
              : sensor.id === "chuva"
                ? 0.6
                : sensor.id === "temperatura"
                  ? 0.5
                  : 1.4;
          const next = Math.max(0, last + (Math.random() - 0.5) * step);
          return { ...sensor, value: next, trend: [...sensor.trend.slice(1), next] };
        })
      );
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [intervalMs]);

  return sensors;
}

export function InstrumentStrip() {
  const sensors = useLiveSensors(SENSORS);

  return (
    <section
      aria-label="Sensores ao vivo"
      className="instrument-face value-in relative overflow-hidden rounded-2xl shadow-lg shadow-forest/10"
    >
      <div className="flex items-center gap-6 overflow-x-auto px-5 py-4 sm:px-7">
        <div className="flex shrink-0 items-center gap-3">
          <span className="live-dot h-2 w-2 rounded-full bg-gold" aria-hidden="true" />
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gold">
              Sensores ao vivo
            </p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-sage/60">
              Área Borrazóis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 sm:gap-10">
          {sensors.map((sensor) => (
            <div key={sensor.id} className="flex shrink-0 flex-col gap-1.5">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-lg font-medium leading-none text-cream">
                  {formatValue(sensor)}
                </span>
                <span className="font-mono text-[10px] text-sage/70">
                  {sensor.unit}
                </span>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-sage/70">
                {sensor.label}
              </p>
              <Sparkline trend={sensor.trend} max={sensor.id === "ar" ? 40 : 100} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
