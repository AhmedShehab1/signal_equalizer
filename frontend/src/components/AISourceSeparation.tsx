/**
 * AI Source Separation Component
 * 
 * Uses Hybrid Demucs AI model via backend to separate audio into
 * drums, bass, vocals, and other instruments.
 */

import React, { useState, useRef } from 'react';
import { separateAudio, processSampleAudio, type SeparationResult } from '../lib/api';

interface SourceResult {
  name: string;
  audioUrl: string;
  spectrogram?: string;
}

export const AISourceSeparation: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeparationResult | null>(null);
  const [sources, setSources] = useState<SourceResult[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioKey, setAudioKey] = useState(0); // Force audio re-render
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourcesRef = useRef<SourceResult[]>([]); // Track current sources for cleanup

  // Keep sourcesRef in sync with sources state
  React.useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Clean up previous audio URLs before setting new file
      cleanupAudioUrls();
      
      setSelectedFile(file);
      setError(null);
      setResult(null);
      setSources([]);
    }
  };

  // Helper function to clean up blob URLs
  const cleanupAudioUrls = () => {
    // Use ref to get current sources, avoiding stale closure
    sourcesRef.current.forEach(source => {
      if (source.audioUrl) {
        try {
          URL.revokeObjectURL(source.audioUrl);
          console.log(`Revoked URL for ${source.name}`);
        } catch (error) {
          console.warn(`Failed to revoke URL for ${source.name}:`, error);
        }
      }
    });
  };

  const processAudio = async (file: File) => {
    // Clean up previous audio URLs FIRST before any state changes
    cleanupAudioUrls();
    
    // Clear sources and increment key to force unmount
    setSources([]);
    setAudioKey(prev => prev + 1);
    
    // Now set processing state
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      console.log('Uploading and processing audio...');
      const separationResult = await separateAudio(file, 5.0, 0.1);  // Faster default
      
      console.log('Processing complete, preparing audio sources...');
      setResult(separationResult);

      // Prepare audio URLs for each source
      const sourceNames = ['drums', 'bass', 'vocals', 'other'] as const;
      const preparedSources: SourceResult[] = [];

      for (const sourceName of sourceNames) {
        const sourceData = separationResult.sources[sourceName];
        
        // Convert audio data back to Float32Array for Web Audio API
        const numChannels = sourceData.audio_shape[0];
        const numSamples = sourceData.audio_shape[1];
        
        // Create AudioBuffer
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = audioContext.createBuffer(
          numChannels,
          numSamples,
          separationResult.sample_rate
        );

        // Fill audio buffer with data
        for (let channel = 0; channel < numChannels; channel++) {
          const channelData = audioBuffer.getChannelData(channel);
          for (let i = 0; i < numSamples; i++) {
            channelData[i] = sourceData.audio_data[channel][i];
          }
        }

        // Convert to WAV blob
        const wavBlob = audioBufferToWav(audioBuffer);
        const audioUrl = URL.createObjectURL(wavBlob);

        preparedSources.push({
          name: sourceName,
          audioUrl,
          spectrogram: sourceData.spectrogram,
        });
      }

      setSources(preparedSources);
      console.log('All sources ready for playback');

    } catch (err) {
      console.error('Error processing audio:', err);
      
      let errorMessage = 'An unknown error occurred';
      if (err instanceof Error) {
        errorMessage = err.message;
        
        // Provide more helpful error messages
        if (errorMessage.includes('Failed to fetch')) {
          errorMessage = 'Connection failed. Make sure the backend server is running on port 8000.';
        } else if (errorMessage.includes('timeout')) {
          errorMessage = 'Processing timed out. Try using a shorter audio file or check if the backend is running.';
        } else if (errorMessage.includes('500')) {
          errorMessage = 'Server error during processing. Check the backend logs for more details.';
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadAndProcess = () => {
    if (selectedFile) {
      processAudio(selectedFile);
    }
  };

  const handleProcessSample = async () => {
    // Clean up and reset state FIRST before any processing
    cleanupAudioUrls();
    setSources([]);
    setAudioKey(prev => prev + 1);
    
    // Now set processing state
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      console.log('Processing sample audio...');
      const separationResult = await processSampleAudio(5.0, 0.1);  // Faster default
      
      console.log('Sample processing complete, preparing audio sources...');
      setResult(separationResult);

      // Prepare audio URLs for each source (same as above)
      const sourceNames = ['drums', 'bass', 'vocals', 'other'] as const;
      const preparedSources: SourceResult[] = [];

      for (const sourceName of sourceNames) {
        const sourceData = separationResult.sources[sourceName];
        
        const numChannels = sourceData.audio_shape[0];
        const numSamples = sourceData.audio_shape[1];
        
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = audioContext.createBuffer(
          numChannels,
          numSamples,
          separationResult.sample_rate
        );

        for (let channel = 0; channel < numChannels; channel++) {
          const channelData = audioBuffer.getChannelData(channel);
          for (let i = 0; i < numSamples; i++) {
            channelData[i] = sourceData.audio_data[channel][i];
          }
        }

        const wavBlob = audioBufferToWav(audioBuffer);
        const audioUrl = URL.createObjectURL(wavBlob);

        preparedSources.push({
          name: sourceName,
          audioUrl,
          spectrogram: sourceData.spectrogram,
        });
      }

      setSources(preparedSources);
      console.log('Sample sources ready for playback');

    } catch (err) {
      console.error('Error processing sample:', err);
      
      let errorMessage = 'An unknown error occurred';
      if (err instanceof Error) {
        errorMessage = err.message;
        
        // Provide more helpful error messages
        if (errorMessage.includes('Failed to fetch')) {
          errorMessage = 'Connection failed. Make sure the backend server is running on port 8000.';
        } else if (errorMessage.includes('timeout')) {
          errorMessage = 'Processing timed out. The AI model may be taking longer than expected.';
        } else if (errorMessage.includes('500')) {
          errorMessage = 'Server error during processing. Check the backend logs for more details.';
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // Cleanup URLs on unmount
  React.useEffect(() => {
    return () => {
      sources.forEach(source => URL.revokeObjectURL(source.audioUrl));
    };
  }, [sources]);

  return (
    <div className="ai-source-separation">
      <h2>🎵 AI Source Separation (Hybrid Demucs)</h2>
      <p className="description">
        Upload an audio file or try the demo to separate it into drums, bass, vocals, and other instruments
        using the state-of-the-art Hybrid Demucs AI model.
      </p>

      {/* Upload Section */}
      <div className="upload-section">
        <div className="upload-controls">
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,.mp3,.flac,.ogg,.m4a"
            onChange={handleFileSelect}
            disabled={isProcessing}
          />
          <button
            onClick={handleUploadAndProcess}
            disabled={!selectedFile || isProcessing}
            className="btn-primary"
          >
            {isProcessing ? 'Processing...' : 'Upload & Separate'}
          </button>
          <button
            onClick={handleProcessSample}
            disabled={isProcessing}
            className="btn-secondary"
          >
            {isProcessing ? 'Processing...' : 'Try Demo Sample'}
          </button>
        </div>
        {selectedFile && (
          <p className="selected-file">Selected: {selectedFile.name}</p>
        )}
      </div>

      {/* Processing Indicator */}
            {/* Processing Indicator */}
      {isProcessing && (
        <div className="processing-indicator">
          <div className="spinner"></div>
          <div className="processing-info">
            <p><strong>Processing audio with Hybrid Demucs AI model...</strong></p>
            <p>⏱️ <strong>Expected time:</strong> 30-90 seconds depending on audio length and your hardware</p>
            <p>🔄 The model is separating your audio into drums, bass, vocals, and other instruments</p>
            <p>� <strong>Tip:</strong> This may take a while on first run as the model downloads (~2GB)</p>
            <p>🖥️ Processing is faster with a GPU (CUDA) if available</p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results */}
      {result && sources.length > 0 && (
        <div className="results">
          <h3>Separation Results</h3>
          
          {/* Original Mixture Spectrogram */}
          {result.mixture_spectrogram && (
            <div className="spectrogram-section">
              <h4>Original Audio (Mixture)</h4>
              <img
                src={result.mixture_spectrogram}
                alt="Original Mixture Spectrogram"
                className="spectrogram-image"
              />
            </div>
          )}

          {/* Separated Sources */}
          <div className="sources-grid">
            {sources.map((source) => (
              <div key={source.name} className="source-card">
                <h4>{source.name.charAt(0).toUpperCase() + source.name.slice(1)}</h4>
                
                {/* Spectrogram */}
                {source.spectrogram && (
                  <img
                    src={source.spectrogram}
                    alt={`${source.name} Spectrogram`}
                    className="spectrogram-image"
                  />
                )}
                
                {/* Audio Player */}
                <audio 
                  key={`${source.name}-${audioKey}`} // Use consistent key for re-rendering
                  controls 
                  src={source.audioUrl} 
                  className="audio-player"
                  preload="none" // Prevent automatic loading of old cached data
                >
                  Your browser does not support the audio element.
                </audio>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Convert AudioBuffer to WAV Blob
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  
  // Interleave channels
  const interleaved = new Float32Array(length * numChannels);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      interleaved[i * numChannels + channel] = channelData[i];
    }
  }
  
  // Create WAV file
  const wavBuffer = new ArrayBuffer(44 + interleaved.length * 2);
  const view = new DataView(wavBuffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + interleaved.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, interleaved.length * 2, true);
  
  // Write samples
  let offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    const sample = Math.max(-1, Math.min(1, interleaved[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }
  
  return new Blob([wavBuffer], { type: 'audio/wav' });
}
