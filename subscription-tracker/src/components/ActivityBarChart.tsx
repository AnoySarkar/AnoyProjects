import React from 'react';
import type { Goal, LogEntry } from '../types';
import { BarChart3 } from 'lucide-react';

interface ActivityBarChartProps {
  goals: Goal[];
  logs: LogEntry[];
  activeMonth: string;
}

export const ActivityBarChart: React.FC<ActivityBarChartProps> = ({
  goals,
  logs,
  activeMonth
}) => {
  const [yearStr, monthStr] = activeMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const totalDays = new Date(year, month, 0).getDate();

  // Aggregate logs by day of the month (1-indexed)
  const dailyTotals = Array.from({ length: totalDays }, (_, i) => {
    const dayNum = i + 1;
    const dStr = dayNum.toString().padStart(2, '0');
    const dateStr = `${activeMonth}-${dStr}`;

    const dayLogs = logs.filter(l => l.date === dateStr);
    
    // Sum weighted completion across goals
    let totalScore = 0;
    dayLogs.forEach(log => {
      const goal = goals.find(g => g.id === log.goalId);
      if (!goal) return;
      
      // We weight the value based on its percentage of the monthly target, 
      // making duration/count values comparable!
      const weight = log.value / goal.target;
      totalScore += weight * 100; // completion percent units
    });

    return {
      day: dayNum,
      score: totalScore,
      date: dateStr
    };
  });

  const maxScore = Math.max(...dailyTotals.map(d => d.score), 10); // Minimum scale floor

  // SVG dimensions
  const width = 600;
  const height = 180;
  const paddingLeft = 30;
  const paddingRight = 10;
  const paddingTop = 20;
  const paddingBottom = 25;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const barWidth = chartWidth / totalDays - 4; // spacing of 4px

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <BarChart3 style={{ color: 'var(--neon-purple)', width: '20px', height: '20px' }} />
        <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-title)', fontWeight: 700 }}>
          Daily Effort Allocation
        </h3>
      </div>
      
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        📊 **Daily Intensity Chart**: Shows your combined goal completion impact across the selected month.
      </p>

      {/* SVG Container */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          width="100%" 
          height="100%" 
          style={{ minWidth: '450px', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="bar-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00f0ff" />
              <stop offset="100%" stopColor="#b026ff" />
            </linearGradient>
            <filter id="bar-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          <line 
            x1={paddingLeft} 
            y1={paddingTop} 
            x2={width - paddingRight} 
            y2={paddingTop} 
            stroke="rgba(255,255,255,0.03)" 
            strokeWidth="1"
          />
          <line 
            x1={paddingLeft} 
            y1={paddingTop + chartHeight / 2} 
            x2={width - paddingRight} 
            y2={paddingTop + chartHeight / 2} 
            stroke="rgba(255,255,255,0.03)" 
            strokeWidth="1" 
            strokeDasharray="4 4"
          />
          <line 
            x1={paddingLeft} 
            y1={height - paddingBottom} 
            x2={width - paddingRight} 
            y2={height - paddingBottom} 
            stroke="rgba(255,255,255,0.08)" 
            strokeWidth="1"
          />

          {/* Y Axis indicator text */}
          <text 
            x={paddingLeft - 8} 
            y={paddingTop + 4} 
            fill="var(--text-muted)" 
            fontSize="8px" 
            textAnchor="end"
          >
            MAX
          </text>
          <text 
            x={paddingLeft - 8} 
            y={height - paddingBottom + 3} 
            fill="var(--text-muted)" 
            fontSize="8px" 
            textAnchor="end"
          >
            0%
          </text>

          {/* Bars */}
          {dailyTotals.map((item, idx) => {
            const barHeight = (item.score / maxScore) * chartHeight;
            const x = paddingLeft + idx * (chartWidth / totalDays) + 2;
            const y = height - paddingBottom - barHeight;

            // Don't draw bars with zero height
            if (item.score === 0) return null;

            return (
              <g key={item.day} className="blue-accent">
                {/* Visual Glow Layer */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill="url(#bar-gradient)"
                  rx="3"
                  filter="url(#bar-glow)"
                  opacity="0.65"
                  style={{ transition: 'all 0.5s ease' }}
                />
                
                {/* Crisp Foreground Layer */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill="url(#bar-gradient)"
                  rx="3"
                  style={{ transition: 'all 0.5s ease' }}
                />

                {/* X Axis labels (Show every 5 days for clarity) */}
                {item.day % 5 === 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={height - paddingBottom + 16}
                    fill="var(--text-muted)"
                    fontSize="9px"
                    textAnchor="middle"
                    fontWeight="500"
                  >
                    {item.day}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
