import React, { useRef, useState } from 'react';
import type { Goal, LogEntry } from '../types';
import { Download, Sparkles, Image as ImageIcon } from 'lucide-react';
import { soundManager } from '../utils/soundManager';

interface QuotaExporterProps {
  goals: Goal[];
  logs: LogEntry[];
  activeMonth: string;
}

export const QuotaExporter: React.FC<QuotaExporterProps> = ({
  goals,
  logs,
  activeMonth
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [yearStr, monthStr] = activeMonth.split('-');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const prettyMonth = `${monthNames[parseInt(monthStr) - 1]} ${yearStr}`;

  // Calculate stats to draw on the card
  const totalGoals = goals.length;
  
  let overallCompletionSum = 0;
  goals.forEach(goal => {
    const goalLogs = logs.filter(l => l.goalId === goal.id);
    const totalLogged = goalLogs.reduce((acc, curr) => acc + curr.value, 0);
    const ratio = Math.min(1.5, totalLogged / goal.target); // Cap display weight
    overallCompletionSum += ratio;
  });

  const avgCompletionRatio = totalGoals > 0 ? overallCompletionSum / totalGoals : 0;
  const overallPercentage = Math.round(avgCompletionRatio * 100);

  // Determine Quota Rank
  const getQuotaRank = () => {
    if (overallPercentage >= 100) return 'TITAN CREATOR';
    if (overallPercentage >= 75) return 'NEON OPERATOR';
    if (overallPercentage >= 40) return 'STEADY FLOW';
    return 'COSMIC IGNITION';
  };

  // Determine core spectrum colors based on goals present
  const getQuotaColors = () => {
    const colors: string[] = [];
    goals.forEach(g => {
      if (g.color === 'pink') colors.push('#ff007f');
      else if (g.color === 'blue') colors.push('#00f0ff');
      else if (g.color === 'green') colors.push('#39ff14');
      else if (g.color === 'purple') colors.push('#b026ff');
      else colors.push('#ff7300');
    });
    // Fallbacks if no goals
    if (colors.length === 0) return ['#00f0ff', '#b026ff'];
    if (colors.length === 1) return [colors[0], '#03030d'];
    return colors.slice(0, 3);
  };

  const handleExport = () => {
    soundManager.playClick();
    setIsGenerating(true);

    // Wait a brief tick to let state register
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        setIsGenerating(false);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsGenerating(false);
        return;
      }

      // Card Canvas dimensions: 640 x 960 (Beautiful vertical poster format)
      canvas.width = 640;
      canvas.height = 960;

      // 1. Draw Background Space Gradient
      const spaceGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      spaceGrad.addColorStop(0, '#030214');
      spaceGrad.addColorStop(0.5, '#070525');
      spaceGrad.addColorStop(1, '#02010c');
      ctx.fillStyle = spaceGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Draw personalized productivity glows in the background
      const quotaColors = getQuotaColors();
      
      // Large blurry core glow
      const quotaGrad1 = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2 - 50, 50,
        canvas.width / 2, canvas.height / 2 - 50, 300
      );
      quotaGrad1.addColorStop(0, quotaColors[0] + '33'); // 20% opacity
      quotaGrad1.addColorStop(0.5, (quotaColors[1] || quotaColors[0]) + '1a'); // 10% opacity
      quotaGrad1.addColorStop(1, 'transparent');
      ctx.fillStyle = quotaGrad1;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2 - 50, 300, 0, Math.PI * 2);
      ctx.fill();

      // Second offset glow to create a dynamic fluid look
      const quotaGrad2 = ctx.createRadialGradient(
        canvas.width / 2 - 80, canvas.height / 2 + 100, 30,
        canvas.width / 2 - 80, canvas.height / 2 + 100, 220
      );
      quotaGrad2.addColorStop(0, (quotaColors[2] || quotaColors[0]) + '22');
      quotaGrad2.addColorStop(1, 'transparent');
      ctx.fillStyle = quotaGrad2;
      ctx.beginPath();
      ctx.arc(canvas.width / 2 - 80, canvas.height / 2 + 100, 220, 0, Math.PI * 2);
      ctx.fill();

      // 3. Draw Fine Metallic Outer Border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 2;
      ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      ctx.strokeRect(22, 22, canvas.width - 44, canvas.height - 44);

      // 4. Draw Header
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.letterSpacing = '3px';
      ctx.textAlign = 'center';
      ctx.fillText('QUOTA PRODUCTIVITY RECORD', canvas.width / 2, 70);

      // Month Title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Outfit, sans-serif';
      ctx.letterSpacing = '-0.5px';
      ctx.fillText(prettyMonth.toUpperCase(), canvas.width / 2, 115);

      // 5. Draw Glassmorphic Container Core Box
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      const boxX = 40;
      const boxY = 160;
      const boxW = canvas.width - 80;
      const boxH = 620;
      const boxRadius = 24;
      
      // Draw rounded rectangle
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(boxX, boxY, boxW, boxH, boxRadius) : ctx.rect(boxX, boxY, boxW, boxH);
      ctx.fill();
      ctx.stroke();

      // Draw active quota particle ring in box center
      const progressRadius = 85;
      const progressCX = canvas.width / 2;
      const progressCY = 310;

      // Draw background progress circle
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(progressCX, progressCY, progressRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw glowing progress arc
      const endAngle = -Math.PI / 2 + (overallPercentage / 100) * Math.PI * 2;
      
      ctx.strokeStyle = quotaColors[0];
      ctx.shadowColor = quotaColors[0];
      ctx.shadowBlur = 15;
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(progressCX, progressCY, progressRadius, -Math.PI / 2, endAngle);
      ctx.stroke();

      // Reset shadows
      ctx.shadowBlur = 0;

      // Draw Central Percentage Text
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 48px Outfit, sans-serif';
      ctx.fillText(`${overallPercentage}%`, progressCX, progressCY + 12);
      
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = 'bold 9px Outfit, sans-serif';
      ctx.letterSpacing = '1px';
      ctx.fillText('COMPLETED', progressCX, progressCY + 32);

      // 6. Draw Goal Progress Bar Items (Maximum top 3 for spacing)
      ctx.textAlign = 'left';
      let startItemY = 460;
      const topGoals = goals.slice(0, 3);

      if (topGoals.length === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = 'italic 16px Plus Jakarta Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No active goals tracked this month.', canvas.width / 2, startItemY + 50);
      } else {
        topGoals.forEach((goal, idx) => {
          const goalLogs = logs.filter(l => l.goalId === goal.id);
          const totalVal = goalLogs.reduce((acc, curr) => acc + curr.value, 0);
          const ratio = Math.min(1.2, totalVal / goal.target);
          const itemPercent = Math.round(ratio * 100);

          // Accent colors
          let col = '#00f0ff';
          if (goal.color === 'pink') col = '#ff007f';
          else if (goal.color === 'green') col = '#39ff14';
          else if (goal.color === 'purple') col = '#b026ff';
          else if (goal.color === 'orange') col = '#ff7300';

          const drawY = startItemY + idx * 75;

          // Goal Title
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 16px Outfit, sans-serif';
          ctx.fillText(goal.name.toUpperCase(), boxX + 30, drawY);

          // Goal fraction text
          ctx.textAlign = 'right';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.font = 'bold 12px Outfit, sans-serif';
          
          let fractionStr = '';
          if (goal.unitType === 'duration') {
            const mins = Math.floor(totalVal / 60);
            const targetMins = Math.floor(goal.target / 60);
            fractionStr = `${mins}m / ${targetMins}m`;
          } else {
            fractionStr = `${totalVal} / ${goal.target}`;
          }
          ctx.fillText(`${fractionStr} (${itemPercent}%)`, boxX + boxW - 30, drawY);
          ctx.textAlign = 'left';

          // Progress Bar Background
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(boxX + 30, drawY + 12, boxW - 60, 8, 4) : ctx.rect(boxX + 30, drawY + 12, boxW - 60, 8);
          ctx.fill();

          // Progress Bar Fill
          ctx.fillStyle = col;
          const barW = Math.max(8, (Math.min(1, totalVal / goal.target) * (boxW - 60)));
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(boxX + 30, drawY + 12, barW, 8, 4) : ctx.rect(boxX + 30, drawY + 12, barW, 8);
          ctx.fill();
        });
      }

      // 7. Draw Quota Rank Title
      const rank = getQuotaRank();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Outfit, sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillText(rank, canvas.width / 2, 730);

      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '500 11px Plus Jakarta Sans, sans-serif';
      ctx.letterSpacing = '0.5px';
      ctx.fillText('PERSONAL QUOTA SPECTRUM RANK', canvas.width / 2, 750);

      // 8. Draw Exporter Logo Footer
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.font = '800 16px Outfit, sans-serif';
      ctx.letterSpacing = '4px';
      ctx.fillText('QUOTA TRACKER', canvas.width / 2, 830);

      // Trigger standard browser download
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `quota-achievement-${activeMonth}.png`;
      link.href = image;
      
      soundManager.playCosmicSuccess();
      link.click();
      
      setIsGenerating(false);
    }, 250);
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Sparkles style={{ color: 'var(--neon-pink)', width: '20px', height: '20px' }} />
        <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-title)', fontWeight: 700 }}>
          Quota Card Exporter
        </h3>
      </div>
      
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        Generate and download a high-fidelity Quota Achievement Card representing your monthly productivity output.
      </p>

      {/* Exporter Preview Widget */}
      <div style={{
        padding: '24px',
        borderRadius: '16px',
        background: 'linear-gradient(to bottom, rgba(5,5,24,0.4), rgba(2,1,12,0.8))',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative glows */}
        <div style={{
          position: 'absolute',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'var(--neon-pink-dim)',
          filter: 'blur(30px)',
          top: '20px',
          left: '20px'
        }} />
        <div style={{
          position: 'absolute',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'var(--neon-blue-dim)',
          filter: 'blur(30px)',
          bottom: '20px',
          right: '20px'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 1, marginBottom: '8px' }}>
          <ImageIcon size={22} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'var(--font-title)' }}>
            {prettyMonth.toUpperCase()} QUOTA CARD
          </span>
        </div>

        <div style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: 'var(--font-title)', color: 'var(--text-primary)', zIndex: 1 }}>
          {getQuotaRank()}
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', zIndex: 1, marginTop: '4px' }}>
          Overall month score: <strong>{overallPercentage}%</strong>
        </div>

        <button
          onClick={handleExport}
          disabled={isGenerating}
          className="pink-accent btn-premium"
          style={{ marginTop: '20px', zIndex: 1, width: '100%', maxWidth: '240px', justifyContent: 'center' }}
        >
          {isGenerating ? (
            'Synthesizing Art...'
          ) : (
            <>
              <Download size={16} /> Export Quota Card
            </>
          )}
        </button>
      </div>

      {/* Hidden layout canvas */}
      <canvas 
        ref={canvasRef} 
        style={{ display: 'none' }} 
      />
    </div>
  );
};
