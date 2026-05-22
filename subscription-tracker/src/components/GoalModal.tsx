import React, { useState } from 'react';
import type { Goal, GoalCategory, GoalUnitType, GoalResetPeriod } from '../types';
import { 
  X, 
  Video, 
  Image as ImageIcon, 
  Headphones, 
  BookOpen, 
  Dumbbell, 
  Code, 
  Trophy 
} from 'lucide-react';
import { soundManager } from '../utils/soundManager';
import { hexToRgb } from '../utils/dateUtils';

interface GoalModalProps {
  onClose: () => void;
  onSave: (goalData: Omit<Goal, 'id' | 'createdAt'>, goalId?: string) => void;
  activeMonth: string; // YYYY-MM
  goalToEdit?: Goal | null;
}

export const GoalModal: React.FC<GoalModalProps> = ({
  onClose,
  onSave,
  activeMonth,
  goalToEdit
}) => {
  const [name, setName] = useState(goalToEdit ? goalToEdit.name : '');
  const [category, setCategory] = useState<GoalCategory>(goalToEdit ? goalToEdit.category : 'ai');
  const [unitType, setUnitType] = useState<GoalUnitType>(goalToEdit ? goalToEdit.unitType : 'count');
  
  // Custom numeric inputs
  const [targetNumber, setTargetNumber] = useState<string>(
    goalToEdit && goalToEdit.unitType === 'count' ? goalToEdit.target.toString() : '500'
  );
  
  // Custom duration inputs: minutes & seconds
  const [targetDurationMinutes, setTargetDurationMinutes] = useState<string>(
    goalToEdit && goalToEdit.unitType === 'duration' ? Math.floor(goalToEdit.target / 60).toString() : '30'
  );
  const [targetDurationSeconds, setTargetDurationSeconds] = useState<string>(
    goalToEdit && goalToEdit.unitType === 'duration' ? (goalToEdit.target % 60).toString() : '0'
  );
  
  const colors = ['blue', 'pink', 'green', 'purple', 'orange'];
  
  const [colorMode, setColorMode] = useState<'preset' | 'custom'>(
    goalToEdit && !colors.includes(goalToEdit.color) ? 'custom' : 'preset'
  );
  const [customColor, setCustomColor] = useState<string>(
    goalToEdit && !colors.includes(goalToEdit.color) ? goalToEdit.color : '#00f0ff'
  );

  const [unitName, setUnitName] = useState(goalToEdit ? goalToEdit.unitName : 'videos');
  const [color, setColor] = useState(goalToEdit ? goalToEdit.color : 'blue');
  const [icon, setIcon] = useState(goalToEdit ? goalToEdit.icon : 'video');
  const [resetDay, setResetDay] = useState<string>(
    goalToEdit && goalToEdit.resetDay ? goalToEdit.resetDay.toString() : '1'
  );
  const [resetPeriod, setResetPeriod] = useState<GoalResetPeriod>(
    goalToEdit && goalToEdit.resetPeriod ? goalToEdit.resetPeriod : 'monthly'
  );
  const [groupName, setGroupName] = useState<string>(
    goalToEdit && goalToEdit.groupName ? goalToEdit.groupName : ''
  );

  const colorsList = ['blue', 'pink', 'green', 'purple', 'orange'];
  
  const iconList = [
    { id: 'video', icon: Video },
    { id: 'image', icon: ImageIcon },
    { id: 'headphones', icon: Headphones },
    { id: 'book', icon: BookOpen },
    { id: 'dumbbell', icon: Dumbbell },
    { id: 'code', icon: Code },
    { id: 'trophy', icon: Trophy }
  ];

  const handleUnitTypeChange = (type: GoalUnitType) => {
    soundManager.playClick();
    setUnitType(type);
    if (type === 'duration') {
      setUnitName('minutes');
    } else {
      setUnitName('videos');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please provide a descriptive name for your goal.');
      return;
    }

    let calculatedTarget = 0;
    if (unitType === 'duration') {
      const mins = parseFloat(targetDurationMinutes);
      const secs = parseFloat(targetDurationSeconds);
      const invalidMins = isNaN(mins) || mins < 0;
      const invalidSecs = isNaN(secs) || secs < 0 || secs >= 60;
      if (invalidMins || invalidSecs || (mins === 0 && secs === 0)) {
        alert('Please enter a valid target duration (must be greater than 0 seconds, with seconds between 0 and 59).');
        return;
      }
      calculatedTarget = mins * 60 + secs; // Store duration in total seconds
    } else {
      const num = parseInt(targetNumber);
      if (isNaN(num) || num <= 0) {
        alert('Please enter a valid target count.');
        return;
      }
      calculatedTarget = num;
    }

    let resetDayNum = 1;
    if (resetPeriod === 'monthly') {
      resetDayNum = parseInt(resetDay);
      if (isNaN(resetDayNum) || resetDayNum < 1 || resetDayNum > 31) {
        alert('Please enter a valid billing reset day between 1 and 31.');
        return;
      }
    }

    soundManager.playCosmicSuccess();
    onSave({
      name: name.trim(),
      category,
      unitType,
      target: calculatedTarget,
      unitName: unitName.trim(),
      color,
      icon,
      month: goalToEdit ? goalToEdit.month : activeMonth,
      resetDay: resetPeriod === 'monthly' ? resetDayNum : 1,
      resetPeriod,
      groupName: groupName.trim() || undefined
    }, goalToEdit?.id);
  };

  const modalAccentClass = 
    color === 'pink' ? 'pink-accent' :
    color === 'blue' ? 'blue-accent' :
    color === 'green' ? 'green-accent' :
    color === 'purple' ? 'purple-accent' :
    color === 'orange' ? 'orange-accent' : '';

  const isCustomColor = color.startsWith('#');
  const customAccentStyle = isCustomColor ? {
    '--accent': color,
    '--accent-glow': `rgba(${hexToRgb(color)}, 0.35)`,
    '--accent-dim': `rgba(${hexToRgb(color)}, 0.1)`
  } as React.CSSProperties : {};

  return (
    <div className="modal-overlay" style={{ display: 'flex', zIndex: 1000 }}>
      <div className={`glass-panel modal-content ${modalAccentClass}`} style={{
        padding: '30px',
        border: '1px solid var(--accent)',
        boxShadow: '0 0 30px var(--accent-glow)',
        background: 'var(--modal-bg)',
        position: 'relative',
        maxHeight: '90vh',
        overflowY: 'auto',
        ...customAccentStyle
      }}>
        <button
          onClick={() => { soundManager.playClick(); onClose(); }}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px'
          }}
        >
          <X size={20} />
        </button>

        <h2 style={{ 
          fontSize: '1.4rem', 
          fontFamily: 'var(--font-title)', 
          fontWeight: 800, 
          color: 'var(--text-primary)', 
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          🛰️ {goalToEdit ? 'Edit Custom Achievement Goal' : 'Create Custom Achievement Goal'}
        </h2>

        <form onSubmit={handleSave}>
          {/* Goal Name & Sub-Group Label */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label className="form-label">Goal Name</label>
              <input
                type="text"
                placeholder="e.g. Midjourney Generations"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label">Sub-Group / Label</label>
              <input
                type="text"
                placeholder="e.g. Account A, GPT-4, Workout"
                className="form-input"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
          </div>

          {/* Workspace Category */}
          <div className="form-group">
            <label className="form-label">Goal Workspace / Category</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => { soundManager.playClick(); setCategory('ai'); }}
                className={`category-select-btn ${category === 'ai' ? 'active' : ''}`}
                style={{ '--accent': 'var(--neon-blue)', '--accent-dim': 'var(--neon-blue-dim)', '--accent-glow': 'var(--neon-blue-glow)' } as any}
              >
                <span>🤖</span> AI & Tech
              </button>
              <button
                type="button"
                onClick={() => { soundManager.playClick(); setCategory('self'); }}
                className={`category-select-btn ${category === 'self' ? 'active' : ''}`}
                style={{ '--accent': 'var(--neon-purple)', '--accent-dim': 'var(--neon-purple-dim)', '--accent-glow': 'var(--neon-purple-glow)' } as any}
              >
                <span>🧠</span> Habit / Self
              </button>
              <button
                type="button"
                onClick={() => { soundManager.playClick(); setCategory('projects'); }}
                className={`category-select-btn ${category === 'projects' ? 'active' : ''}`}
                style={{ '--accent': 'var(--neon-pink)', '--accent-dim': 'var(--neon-pink-dim)', '--accent-glow': 'var(--neon-pink-glow)' } as any}
              >
                <span>💼</span> Project Output
              </button>
            </div>
          </div>

          {/* Reset Period Select */}
          <div className="form-group">
            <label className="form-label">Reset Period / Limit Scope</label>
            <select
              value={resetPeriod}
              onChange={(e) => { soundManager.playClick(); setResetPeriod(e.target.value as GoalResetPeriod); }}
              className="form-input"
              style={{ background: 'rgba(0,0,0,0.4)', color: 'var(--text-primary)' }}
            >
              <option value="daily" style={{ background: '#08081a' }}>Daily limit (resets every day)</option>
              <option value="weekly" style={{ background: '#08081a' }}>Weekly limit (resets every Monday)</option>
              <option value="monthly" style={{ background: '#08081a' }}>Monthly limit (resets monthly / billing cycle)</option>
            </select>
          </div>

          {/* Unit Nature and Target Limit inputs */}
          <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label className="form-label">Goal Nature</label>
              <div className="nature-toggle-container">
                <button
                  type="button"
                  onClick={() => handleUnitTypeChange('count')}
                  className={`nature-toggle-btn ${unitType === 'count' ? 'active' : ''}`}
                >
                  Quantity Count
                </button>
                <button
                  type="button"
                  onClick={() => handleUnitTypeChange('duration')}
                  className={`nature-toggle-btn ${unitType === 'duration' ? 'active' : ''}`}
                >
                  Time Duration
                </button>
              </div>
            </div>

            {/* Target inputs dynamically shown */}
            {unitType === 'count' ? (
              <div>
                <label className="form-label">{resetPeriod.toUpperCase()} Target Limit</label>
                <input
                  type="number"
                  placeholder="500"
                  className="form-input"
                  value={targetNumber}
                  onChange={(e) => setTargetNumber(e.target.value)}
                  min="1"
                  required
                  style={{ height: '42px' }}
                />
              </div>
            ) : (
              <div>
                <label className="form-label">{resetPeriod.toUpperCase()} Target (Min & Sec)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    placeholder="Min"
                    className="form-input"
                    value={targetDurationMinutes}
                    onChange={(e) => setTargetDurationMinutes(e.target.value)}
                    min="0"
                    required
                    title="Minutes"
                    style={{ height: '42px', flex: 1, textAlign: 'center' }}
                  />
                  <input
                    type="number"
                    placeholder="Sec"
                    className="form-input"
                    value={targetDurationSeconds}
                    onChange={(e) => setTargetDurationSeconds(e.target.value)}
                    min="0"
                    max="59"
                    required
                    title="Seconds"
                    style={{ height: '42px', flex: 1, textAlign: 'center' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Custom Billing Cycle Reset Day (Only shown for monthly reset periods) */}
          {resetPeriod === 'monthly' && (
            <div className="form-group">
              <label className="form-label">Billing Reset Day (1-31)</label>
              <input
                type="number"
                placeholder="e.g. 12"
                className="form-input"
                value={resetDay}
                onChange={(e) => setResetDay(e.target.value)}
                min="1"
                max="31"
                required
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block', lineHeight: '1.3' }}>
                Select the day of the month your subscription resets.
              </span>
            </div>
          )}

          {/* Unit Name (Videos/Images/etc) */}
          {unitType === 'count' && (
            <div className="form-group">
              <label className="form-label">Unit Item Name</label>
              <input
                type="text"
                placeholder="e.g. videos, images, sessions"
                className="form-input"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                required
              />
            </div>
          )}

          {/* Color pickers */}
          <div className="form-group">
            <label className="form-label">Custom Neon Quota Accent</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { soundManager.playClick(); setColorMode('preset'); }}
                  className={`workspace-tab ${colorMode === 'preset' ? 'active' : ''}`}
                  style={{ padding: '4px 12px', fontSize: '0.78rem', borderRadius: '8px' }}
                >
                  Presets
                </button>
                <button
                  type="button"
                  onClick={() => { soundManager.playClick(); setColorMode('custom'); }}
                  className={`workspace-tab ${colorMode === 'custom' ? 'active' : ''}`}
                  style={{ padding: '4px 12px', fontSize: '0.78rem', borderRadius: '8px' }}
                >
                  RGB Selector
                </button>
              </div>

              {colorMode === 'preset' ? (
                <div className="color-option-container" style={{ marginTop: '4px' }}>
                  {colorsList.map(col => {
                    const accentDotClass = 
                      col === 'pink' ? 'pink-accent' :
                      col === 'blue' ? 'blue-accent' :
                      col === 'green' ? 'green-accent' :
                      col === 'purple' ? 'purple-accent' :
                      'orange-accent';

                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => { soundManager.playClick(); setColor(col); }}
                        className={`color-picker-dot ${accentDotClass} ${color === col ? 'active' : ''}`}
                        style={{ background: `var(--neon-${col})`, border: 'none' }}
                      />
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => { soundManager.playClick(); setCustomColor(e.target.value); setColor(e.target.value); }}
                    style={{
                      width: '42px',
                      height: '42px',
                      border: 'none',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      background: 'transparent',
                      padding: 0
                    }}
                    title="Choose custom RGB color"
                  />
                  <input
                    type="text"
                    value={customColor}
                    onChange={(e) => { setColor(e.target.value); setCustomColor(e.target.value); }}
                    className="form-input"
                    placeholder="#00f0ff"
                    style={{
                      width: '120px',
                      fontSize: '0.85rem',
                      textTransform: 'uppercase',
                      textAlign: 'center'
                    }}
                  />
                  <span style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)'
                  }}>
                    Pick or type hex code
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Custom theme icons */}
          <div className="form-group">
            <label className="form-label">Dashboard Icon Representative</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
              <div>
                <input
                  type="text"
                  placeholder="Or enter any custom Emoji (e.g. 🍿, 🚀, 🎯, 🏋️)"
                  className="form-input"
                  value={icon.length > 0 && !iconList.some(item => item.id === icon) ? icon : ''}
                  onChange={(e) => { setIcon(e.target.value.trim() || 'video'); }}
                  maxLength={10}
                  style={{ fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {iconList.map(item => {
                  const IconComponent = item.icon;
                  const isSelected = icon === item.id;
                  
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { soundManager.playClick(); setIcon(item.id); }}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isSelected ? 'var(--accent-dim)' : 'rgba(255,255,255,0.02)',
                        border: isSelected ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
                        color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                        boxShadow: isSelected ? '0 0 10px var(--accent-glow)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      <IconComponent size={18} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '30px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => { soundManager.playClick(); onClose(); }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-premium"
            >
              {goalToEdit ? 'Save Changes' : 'Save Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
