'use client';

import { ReferenceLine } from 'recharts';

export default function ROIBreakevenLine() {
  return (
    <ReferenceLine
      y={0}
      stroke="#9ca3af"
      strokeDasharray="4 4"
      label={{ value: 'Breakeven', position: 'right', fontSize: 10, fill: '#9ca3af' }}
    />
  );
}
