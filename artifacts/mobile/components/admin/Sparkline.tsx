import React from "react";
import { Text, View } from "react-native";
import Svg, {
  Path,
  Circle,
  Line,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { useColors } from "@/hooks/useColors";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Optional second series, drawn in a muted color underneath. */
  secondary?: number[];
  showAxes?: boolean;
  showGrid?: boolean;
  /** Label rendered above the chart. */
  title?: string;
  /** Optional caption below the chart. */
  caption?: string;
  /** Tints the line + gradient. Defaults to c.primary. */
  color?: string;
}

/**
 * Inline SVG line chart, Stripe-style:
 *   - horizontal gridlines + baseline
 *   - line drawn with rounded joins
 *   - soft gradient fill below the line
 *   - single highlighted dot on the last data point
 *   - title / caption above and below
 */
export function Sparkline({
  data,
  width = 560,
  height = 200,
  secondary,
  title,
  caption,
  showAxes = true,
  showGrid = true,
  color,
}: SparklineProps) {
  const c = useColors();
  const series = [data, ...(secondary ? [secondary] : [])];
  const allValues = series.flat();
  const max = Math.max(1, ...allValues);
  const min = Math.min(0, ...allValues);
  const range = max - min || 1;
  const padX = 24;
  const padY = 24;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const primary = color ?? c.primary;
  const secondaryColor = c.mutedForeground;
  const longest = Math.max(data.length, secondary?.length ?? 0);
  const stepX = longest > 1 ? innerW / (longest - 1) : innerW;

  function points(values: number[]) {
    return values.map((v, i) => {
      const x = padX + i * stepX;
      const y = padY + innerH - ((v - min) / range) * innerH;
      return [x, y] as const;
    });
  }

  function buildPath(values: number[]): string {
    if (values.length === 0) return "";
    const pts = points(values);
    return pts
      .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
      .join(" ");
  }

  function buildFillPath(values: number[]): string {
    if (values.length === 0) return "";
    const pts = points(values);
    let d = `M ${pts[0][0]} ${padY + innerH} `;
    for (const [x, y] of pts) d += `L ${x} ${y} `;
    d += `L ${pts[pts.length - 1][0]} ${padY + innerH} Z`;
    return d;
  }

  // Gridlines: 4 horizontal lines including baseline + top
  const gridY = Array.from({ length: 4 }, (_, i) => padY + (innerH / 3) * i);

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: c.border,
        padding: 18,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {title ? (
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: c.foreground }}>{title}</Text>
        </View>
      ) : null}
      <Text style={{ fontSize: 22, fontWeight: "800", color: c.foreground, marginBottom: 12 }}>
        {data.reduce((a, b) => a + b, 0).toLocaleString()}
      </Text>

      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <Defs>
          <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={primary} stopOpacity={0.32} />
            <Stop offset="1" stopColor={primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Gridlines */}
        {showGrid
          ? gridY.map((y, i) => (
              <Line
                key={i}
                x1={padX}
                y1={y}
                x2={padX + innerW}
                y2={y}
                stroke={c.border}
                strokeWidth={1}
                strokeDasharray={i === gridY.length - 1 ? undefined : "3 4"}
              />
            ))
          : null}

        {/* Optional y-axis */}
        {showAxes ? (
          <Line
            x1={padX}
            y1={padY}
            x2={padX}
            y2={padY + innerH}
            stroke={c.border}
            strokeWidth={1}
          />
        ) : null}

        {/* Secondary series, drawn muted underneath the primary */}
        {secondary ? (
          <Path
            d={buildPath(secondary)}
            stroke={secondaryColor}
            strokeOpacity={0.45}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* Gradient fill under primary line */}
        <Path d={buildFillPath(data)} fill="url(#sparkFill)" />

        {/* Primary line */}
        <Path
          d={buildPath(data)}
          stroke={primary}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Single highlighted dot on the last data point */}
        {data.length > 0
          ? (() => {
              const [lx, ly] = points(data).slice(-1)[0];
              return (
                <>
                  <Circle cx={lx} cy={ly} r={6} fill={c.card} stroke={primary} strokeWidth={2.5} />
                </>
              );
            })()
          : null}
      </Svg>

      {caption ? (
        <Text style={{ marginTop: 10, fontSize: 12, color: c.mutedForeground }}>{caption}</Text>
      ) : null}
    </View>
  );
}
