/**
 * Tests for LinkedWaveformViewers component (Phase 5)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LinkedWaveformViewers from '../LinkedWaveformViewers';

// Mock WaveformViewer component
vi.mock('../WaveformViewer', () => ({
  default: ({ currentTime, viewRange, onViewRangeChange, title }: any) => (
    <div data-testid={`waveform-${title}`}>
      <span data-testid="current-time">{currentTime}</span>
      <span data-testid="view-range">{JSON.stringify(viewRange)}</span>
      <button
        data-testid="trigger-zoom"
        onClick={() => {
          if (onViewRangeChange) {
            onViewRangeChange({
              startTime: 1.0,
              endTime: 5.0,
              zoomLevel: 2.0,
            });
          }
        }}
      >
        Zoom
      </button>
    </div>
  ),
}));

describe('LinkedWaveformViewers', () => {
  let mockInputBuffer: AudioBuffer;
  let mockOutputBuffer: AudioBuffer;

  beforeEach(() => {
    // Create mock AudioBuffer
    const createMockBuffer = (duration: number): AudioBuffer => ({
      duration,
      length: duration * 44100,
      numberOfChannels: 1,
      sampleRate: 44100,
      getChannelData: vi.fn(() => new Float32Array(duration * 44100)),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    } as any);

    mockInputBuffer = createMockBuffer(10);
    mockOutputBuffer = createMockBuffer(10);
  });

  it('renders both input and output viewers', () => {
    render(
      <LinkedWaveformViewers
        inputBuffer={mockInputBuffer}
        outputBuffer={mockOutputBuffer}
        currentTime={0}
      />
    );

    expect(screen.getByTestId('waveform-Input Signal')).toBeTruthy();
    expect(screen.getByTestId('waveform-Output Signal (EQ Applied)')).toBeTruthy();
  });

  it('passes current time to both viewers', () => {
    const currentTime = 3.5;
    render(
      <LinkedWaveformViewers
        inputBuffer={mockInputBuffer}
        outputBuffer={mockOutputBuffer}
        currentTime={currentTime}
      />
    );

    const timeElements = screen.getAllByTestId('current-time');
    expect(timeElements).toHaveLength(2);
    timeElements.forEach((el: HTMLElement) => {
      expect(el.textContent).toBe(currentTime.toString());
    });
  });

  it('shares view range between both viewers', () => {
    render(
      <LinkedWaveformViewers
        inputBuffer={mockInputBuffer}
        outputBuffer={mockOutputBuffer}
        currentTime={0}
      />
    );

    const viewRangeElements = screen.getAllByTestId('view-range');
    expect(viewRangeElements).toHaveLength(2);

    // Both should have the same initial view range
    const range1 = JSON.parse(viewRangeElements[0].textContent || '{}');
    const range2 = JSON.parse(viewRangeElements[1].textContent || '{}');

    expect(range1).toEqual(range2);
    expect(range1.startTime).toBe(0);
    expect(range1.endTime).toBe(10);
    expect(range1.zoomLevel).toBe(1.0);
  });

  it('updates both viewers when one changes zoom', () => {
    render(
      <LinkedWaveformViewers
        inputBuffer={mockInputBuffer}
        outputBuffer={mockOutputBuffer}
        currentTime={0}
      />
    );

    // Trigger zoom change from first viewer
    const zoomButtons = screen.getAllByTestId('trigger-zoom');
    fireEvent.click(zoomButtons[0]);

    // Both viewers should have the updated range
    const viewRangeElements = screen.getAllByTestId('view-range');
    viewRangeElements.forEach((el: HTMLElement) => {
      const range = JSON.parse(el.textContent || '{}');
      expect(range.startTime).toBe(1.0);
      expect(range.endTime).toBe(5.0);
      expect(range.zoomLevel).toBe(2.0);
    });
  });

  it('renders reset view button', () => {
    render(
      <LinkedWaveformViewers
        inputBuffer={mockInputBuffer}
        outputBuffer={mockOutputBuffer}
        currentTime={0}
      />
    );

    const resetButton = screen.getByRole('button', { name: /reset view/i });
    expect(resetButton).toBeTruthy();
  });

  it('resets view range when reset button clicked', () => {
    render(
      <LinkedWaveformViewers
        inputBuffer={mockInputBuffer}
        outputBuffer={mockOutputBuffer}
        currentTime={0}
      />
    );

    // First zoom in
    const zoomButtons = screen.getAllByTestId('trigger-zoom');
    fireEvent.click(zoomButtons[0]);

    // Verify zoom applied
    let viewRangeElements = screen.getAllByTestId('view-range');
    let range = JSON.parse(viewRangeElements[0].textContent || '{}');
    expect(range.zoomLevel).toBe(2.0);

    // Click reset
    const resetButton = screen.getByRole('button', { name: /reset view/i });
    fireEvent.click(resetButton);

    // Verify reset to full view
    viewRangeElements = screen.getAllByTestId('view-range');
    range = JSON.parse(viewRangeElements[0].textContent || '{}');
    expect(range.startTime).toBe(0);
    expect(range.endTime).toBe(10);
    expect(range.zoomLevel).toBe(1.0);
  });

  it('displays current zoom level', () => {
    render(
      <LinkedWaveformViewers
        inputBuffer={mockInputBuffer}
        outputBuffer={mockOutputBuffer}
        currentTime={0}
      />
    );

    expect(screen.getByText(/Zoom: 1\.0x/)).toBeTruthy();

    // Trigger zoom change
    const zoomButtons = screen.getAllByTestId('trigger-zoom');
    fireEvent.click(zoomButtons[0]);

    expect(screen.getByText(/Zoom: 2\.0x/)).toBeTruthy();
  });

  it('disables reset button when no buffers available', () => {
    render(
      <LinkedWaveformViewers
        inputBuffer={null}
        outputBuffer={null}
        currentTime={0}
      />
    );

    const resetButton = screen.getByRole('button', { name: /reset view/i });
    expect(resetButton.hasAttribute('disabled')).toBe(true);
  });

  it('updates view range when buffer duration changes', () => {
    const { rerender } = render(
      <LinkedWaveformViewers
        inputBuffer={mockInputBuffer}
        outputBuffer={mockOutputBuffer}
        currentTime={0}
      />
    );

    // Create new buffer with different duration
    const newBuffer = {
      duration: 20,
      length: 20 * 44100,
      numberOfChannels: 1,
      sampleRate: 44100,
      getChannelData: vi.fn(() => new Float32Array(20 * 44100)),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    } as any;

    // Click reset to apply new duration
    rerender(
      <LinkedWaveformViewers
        inputBuffer={newBuffer}
        outputBuffer={mockOutputBuffer}
        currentTime={0}
      />
    );

    const resetButton = screen.getByRole('button', { name: /reset view/i });
    fireEvent.click(resetButton);

    const viewRangeElements = screen.getAllByTestId('view-range');
    const range = JSON.parse(viewRangeElements[0].textContent || '{}');
    expect(range.endTime).toBe(20);
  });
});
