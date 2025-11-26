/**
 * Visual Frequency Curve Editor - Phase 3 Implementation
 * Interactive frequency response curve with draggable control points
 */

import { useState, useRef, useEffect } from 'react';
import './FrequencyCurveEditor.css';

interface ControlPoint {
  id: string;
  frequency: number; // Hz
  gain: number; // dB (-12 to +12)
  q: number; // Q factor (0.1 to 10)
}

interface FrequencyCurveEditorProps {
  sampleRate: number;
  onCurveChange?: (points: ControlPoint[]) => void;
  disabled?: boolean;
}

export default function FrequencyCurveEditor({
  sampleRate,
  onCurveChange,
  disabled = false,
}: FrequencyCurveEditorProps) {
  const [controlPoints, setControlPoints] = useState<ControlPoint[]>([
    { id: '1', frequency: 100, gain: 0, q: 1 },
    { id: '2', frequency: 1000, gain: 0, q: 1 },
    { id: '3', frequency: 10000, gain: 0, q: 1 },
  ]);
  
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const minFreq = 20;
  const maxFreq = sampleRate / 2;
  const minGain = -12;
  const maxGain = 12;
  
  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ 
          width: Math.max(400, width - 80), // Account for y-axis labels
          height: Math.max(300, height) 
        });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);
  
  const { width, height } = dimensions;
  
  // Convert frequency to X position (logarithmic scale)
  const freqToX = (freq: number): number => {
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logFreq = Math.log10(freq);
    return ((logFreq - logMin) / (logMax - logMin)) * width;
  };
  
  // Convert X position to frequency (logarithmic scale)
  const xToFreq = (x: number): number => {
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logFreq = logMin + (x / width) * (logMax - logMin);
    return Math.pow(10, logFreq);
  };
  
  // Convert gain to Y position
  const gainToY = (gain: number): number => {
    return ((maxGain - gain) / (maxGain - minGain)) * height;
  };
  
  // Convert Y position to gain
  const yToGain = (y: number): number => {
    return maxGain - (y / height) * (maxGain - minGain);
  };
  
  // Generate SVG path for frequency response curve
  const generateCurvePath = (): string => {
    const sortedPoints = [...controlPoints].sort((a, b) => a.frequency - b.frequency);
    const points: string[] = [];
    
    // Sample the curve at regular intervals
    for (let x = 0; x <= width; x += 2) {
      const freq = xToFreq(x);
      let gain = 0;
      
      // Sum contributions from all control points
      sortedPoints.forEach(point => {
        const freqRatio = freq / point.frequency;
        const logRatio = Math.log10(freqRatio);
        const bandwidth = 1 / point.q;
        const response = point.gain / (1 + Math.pow(logRatio / bandwidth, 2));
        gain += response;
      });
      
      const y = gainToY(gain);
      points.push(x === 0 ? `M ${x},${y}` : `L ${x},${y}`);
    }
    
    return points.join(' ');
  };
  
  // Handle mouse down on control point
  const handlePointMouseDown = (id: string, e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    setSelectedPoint(id);
    setIsDragging(true);
  };
  
  // Handle mouse down on canvas (add new point)
  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (disabled || isDragging) return;
    
    const svg = svgRef.current;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newPoint: ControlPoint = {
      id: Date.now().toString(),
      frequency: Math.round(xToFreq(x)),
      gain: Math.round(yToGain(y) * 10) / 10,
      q: 1,
    };
    
    const newPoints = [...controlPoints, newPoint];
    setControlPoints(newPoints);
    setSelectedPoint(newPoint.id);
    onCurveChange?.(newPoints);
  };
  
  // Handle mouse move
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || !selectedPoint || disabled) return;
    
    const svg = svgRef.current;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const x = Math.max(0, Math.min(width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(height, e.clientY - rect.top));
    
    const newFreq = Math.max(minFreq, Math.min(maxFreq, xToFreq(x)));
    const newGain = Math.max(minGain, Math.min(maxGain, yToGain(y)));
    
    const newPoints = controlPoints.map(point =>
      point.id === selectedPoint
        ? { ...point, frequency: Math.round(newFreq), gain: Math.round(newGain * 10) / 10 }
        : point
    );
    
    setControlPoints(newPoints);
    onCurveChange?.(newPoints);
  };
  
  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Handle point deletion (double-click)
  const handlePointDoubleClick = (id: string, e: React.MouseEvent) => {
    if (disabled || controlPoints.length <= 1) return;
    e.stopPropagation();
    
    const newPoints = controlPoints.filter(point => point.id !== id);
    setControlPoints(newPoints);
    setSelectedPoint(null);
    onCurveChange?.(newPoints);
  };
  
  // Handle Q factor change
  const handleQChange = (id: string, q: number) => {
    const newPoints = controlPoints.map(point =>
      point.id === id ? { ...point, q } : point
    );
    setControlPoints(newPoints);
    onCurveChange?.(newPoints);
  };
  
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);
  
  const selectedPointData = controlPoints.find(p => p.id === selectedPoint);
  
  return (
    <div className="frequency-curve-editor glass-panel">
      <div className="editor-header">
        <h3>🎛️ Frequency Response Curve</h3>
        <div className="editor-info">
          <span className="badge badge-primary">{controlPoints.length} Points</span>
          <span className="help-text">Click to add • Drag to adjust • Double-click to delete</span>
        </div>
      </div>
      
      <div className="curve-canvas-wrapper" ref={containerRef}>
        <svg
          ref={svgRef}
          className="curve-canvas"
          width={width}
          height={height}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ cursor: disabled ? 'not-allowed' : isDragging ? 'grabbing' : 'crosshair' }}
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
            </pattern>
            
            {/* Gradient fill for curve */}
            <linearGradient id="curveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.4" />
              <stop offset="50%" stopColor="var(--color-primary)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--color-secondary)" stopOpacity="0.1" />
            </linearGradient>
            
            {/* Glow filter */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <rect width={width} height={height} fill="url(#grid)" />
          
          {/* Center line (0 dB) */}
          <line
            x1={0}
            y1={gainToY(0)}
            x2={width}
            y2={gainToY(0)}
            stroke="rgba(0, 245, 255, 0.3)"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          
          {/* Frequency response curve with gradient fill */}
          <path
            d={`${generateCurvePath()} L ${width},${height} L 0,${height} Z`}
            fill="url(#curveGradient)"
            opacity="0.8"
          />
          
          {/* Frequency response curve stroke */}
          <path
            d={generateCurvePath()}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="3"
            filter="url(#glow)"
          />
          
          {/* Control points */}
          {controlPoints.map(point => {
            const x = freqToX(point.frequency);
            const y = gainToY(point.gain);
            const isSelected = point.id === selectedPoint;
            const isHovered = point.id === hoveredPoint;
            
            return (
              <g key={point.id}>
                {/* Q width indicator */}
                <ellipse
                  cx={x}
                  cy={y}
                  rx={30 / point.q}
                  ry={20 / point.q}
                  fill="rgba(0, 245, 255, 0.1)"
                  stroke="rgba(0, 245, 255, 0.3)"
                  strokeWidth="1"
                  opacity={isSelected || isHovered ? 1 : 0.5}
                />
                
                {/* Control point */}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 8 : isHovered ? 7 : 6}
                  fill={isSelected ? 'var(--color-accent)' : 'var(--color-primary)'}
                  stroke="var(--color-background)"
                  strokeWidth="2"
                  className="control-point"
                  style={{ cursor: disabled ? 'not-allowed' : 'grab' }}
                  onMouseDown={(e) => handlePointMouseDown(point.id, e)}
                  onMouseEnter={() => setHoveredPoint(point.id)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  onDoubleClick={(e) => handlePointDoubleClick(point.id, e)}
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
                />
                
                {/* Frequency label */}
                {(isSelected || isHovered) && (
                  <text
                    x={x}
                    y={y - 15}
                    textAnchor="middle"
                    fill="var(--color-text-primary)"
                    fontSize="11"
                    fontWeight="600"
                  >
                    {point.frequency < 1000 
                      ? `${point.frequency}Hz` 
                      : `${(point.frequency / 1000).toFixed(1)}kHz`}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        
        {/* Y-axis labels (gain) */}
        <div className="y-axis-labels">
          <span>+{maxGain} dB</span>
          <span>0 dB</span>
          <span>{minGain} dB</span>
        </div>
      </div>
      
      {/* Point details panel */}
      {selectedPointData && (
        <div className="point-details glass-panel-light">
          <h4>Selected Point</h4>
          <div className="point-controls">
            <div className="control-group">
              <label>
                Frequency: <strong>{selectedPointData.frequency} Hz</strong>
              </label>
            </div>
            <div className="control-group">
              <label>
                Gain: <strong>{selectedPointData.gain.toFixed(1)} dB</strong>
              </label>
            </div>
            <div className="control-group">
              <label htmlFor={`q-${selectedPointData.id}`}>
                Q Factor: <strong>{selectedPointData.q.toFixed(2)}</strong>
              </label>
              <input
                id={`q-${selectedPointData.id}`}
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={selectedPointData.q}
                onChange={(e) => handleQChange(selectedPointData.id, parseFloat(e.target.value))}
                disabled={disabled}
              />
              <div className="range-labels">
                <span>Wide</span>
                <span>Narrow</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { ControlPoint };
