/**
 * Component for loading audio files
 */

import { useRef } from 'react';

interface FileLoaderProps {
  onFileLoad: (buffer: AudioBuffer, fileName: string, file: File) => void;
}

export default function FileLoader({ onFileLoad }: FileLoaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      onFileLoad(audioBuffer, file.name, file);
    } catch (error) {
      console.error('Error loading audio file:', error);
      alert('Failed to load audio file. Please try a different file.');
    }
  };

  return (
    <div className="file-loader">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button onClick={() => fileInputRef.current?.click()}>
        Load Audio File
      </button>
    </div>
  );
}
