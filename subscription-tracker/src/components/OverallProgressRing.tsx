import React from 'react';

interface OverallProgressRingProps {
  percentage: number;
}

export const OverallProgressRing: React.FC<OverallProgressRingProps> = ({ percentage }) => {
  const cleanPercent = Math.min(100, Math.max(0, isNaN(percentage) ? 0 : percentage));
  
  // SVG Ring values
  const radius = 70;
  const strokeWidth = 10;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (cleanPercent / 100) * circumference;

  return (
    <div className="glass-panel animate-shimmer" style={{
      padding: '24px',
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Neon Purple/Blue accent class */}
      <div className="blue-accent" style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
        {/* Glow Filters */}
        <svg height="120" width="120" style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <filter id="glow-circle" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="gradient-ring" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00f0ff" />
              <stop offset="100%" stopColor="#b026ff" />
            </linearGradient>
          </defs>
          
          {/* Background Ring */}
          <circle
            stroke="rgba(255, 255, 255, 0.03)"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius - 10}
            cy={radius - 10}
          />
          
          {/* Glowing Animated Ring */}
          <circle
            stroke="url(#gradient-ring)"
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ 
              strokeDashoffset, 
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: 'url(#glow-circle)' 
            }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius - 10}
            cy={radius - 10}
          />
        </svg>
        
        {/* Inner Centered Percentage Text */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <span style={{ 
            fontFamily: 'var(--font-title)', 
            fontSize: '1.6rem', 
            fontWeight: 800,
            background: 'linear-gradient(to right, #00f0ff, #b026ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 2px 8px rgba(0, 240, 255, 0.2))'
          }}>
            {Math.round(cleanPercent)}%
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-title)', fontWeight: 700, color: 'var(--text-primary)' }}>
          Overall Progress
        </h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Your average achievements across all active goals for the selected month.
        </p>
        <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</div>
            <div style={{ 
              fontSize: '0.9rem', 
              fontWeight: 600, 
              color: cleanPercent >= 100 ? 'var(--neon-green)' : cleanPercent >= 50 ? 'var(--neon-blue)' : 'var(--neon-pink)' 
            }}>
              {cleanPercent >= 100 ? '🚀 FULLY SATISFIED' : cleanPercent >= 75 ? '⚡ HIGH OUTPUT' : cleanPercent >= 40 ? '📈 ON TRACK' : '☄️ STARTING UP'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
