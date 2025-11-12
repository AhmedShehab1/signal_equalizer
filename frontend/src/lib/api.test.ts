/**
 * API Client Test Suite
 * 
 * Manual tests for the API client functions.
 * Run with: npm run dev (then test in browser console)
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {
  separateSpeechAudio,
  processSpeechSample,
  checkHealth,
  getAPIInfo,
  audioArrayToWav,
  getSourceLabel,
  isSpeechSeparation,
  getSourceKeys,
  type SeparationResult,
  type SpeechSeparationResult,
} from './api';

// ============================================================================
// Test Data
// ============================================================================

const mockMusicResult: SeparationResult = {
  sample_rate: 44100,
  sources: {
    drums: {
      audio_shape: [2, 441000],
      audio_data: [[0.1, 0.2], [0.3, 0.4]],
      spectrogram: 'data:image/png;base64,mock',
    },
    bass: {
      audio_shape: [2, 441000],
      audio_data: [[0.1, 0.2], [0.3, 0.4]],
      spectrogram: 'data:image/png;base64,mock',
    },
    vocals: {
      audio_shape: [2, 441000],
      audio_data: [[0.1, 0.2], [0.3, 0.4]],
      spectrogram: 'data:image/png;base64,mock',
    },
    other: {
      audio_shape: [2, 441000],
      audio_data: [[0.1, 0.2], [0.3, 0.4]],
      spectrogram: 'data:image/png;base64,mock',
    },
  },
  mixture_spectrogram: 'data:image/png;base64,mock',
};

const mockSpeechResult: SpeechSeparationResult = {
  sample_rate: 8000,
  num_sources: 3,
  sources: {
    source_0: {
      audio_shape: [24000],
      audio_data: [0.1, 0.2, 0.3],
      spectrogram: 'data:image/png;base64,mock',
    },
    source_1: {
      audio_shape: [24000],
      audio_data: [0.4, 0.5, 0.6],
      spectrogram: 'data:image/png;base64,mock',
    },
    source_2: {
      audio_shape: [24000],
      audio_data: [0.7, 0.8, 0.9],
      spectrogram: 'data:image/png;base64,mock',
    },
  },
  mixture_spectrogram: 'data:image/png;base64,mock',
};

// ============================================================================
// Utility Function Tests
// ============================================================================

export function testGetSourceLabel() {
  console.log('Testing getSourceLabel()...');
  
  // Test music sources
  console.assert(getSourceLabel('drums') === 'Drums', 'Music source: drums');
  console.assert(getSourceLabel('bass') === 'Bass', 'Music source: bass');
  console.assert(getSourceLabel('vocals') === 'Vocals', 'Music source: vocals');
  console.assert(getSourceLabel('other') === 'Other', 'Music source: other');
  
  // Test speech sources (0-indexed to 1-indexed)
  console.assert(getSourceLabel('source_0') === 'Source 1', 'Speech source: source_0');
  console.assert(getSourceLabel('source_1') === 'Source 2', 'Speech source: source_1');
  console.assert(getSourceLabel('source_2') === 'Source 3', 'Speech source: source_2');
  console.assert(getSourceLabel('source_10') === 'Source 11', 'Speech source: source_10');
  
  console.log('✅ getSourceLabel() tests passed');
}

export function testIsSpeechSeparation() {
  console.log('Testing isSpeechSeparation()...');
  
  console.assert(
    !isSpeechSeparation(mockMusicResult),
    'Music result should return false'
  );
  console.assert(
    isSpeechSeparation(mockSpeechResult),
    'Speech result should return true'
  );
  
  console.log('✅ isSpeechSeparation() tests passed');
}

export function testGetSourceKeys() {
  console.log('Testing getSourceKeys()...');
  
  const musicKeys = getSourceKeys(mockMusicResult);
  console.assert(
    musicKeys.length === 4 &&
    musicKeys.includes('drums') &&
    musicKeys.includes('bass') &&
    musicKeys.includes('vocals') &&
    musicKeys.includes('other'),
    'Music result should have 4 sources'
  );
  
  const speechKeys = getSourceKeys(mockSpeechResult);
  console.assert(
    speechKeys.length === 3 &&
    speechKeys.includes('source_0') &&
    speechKeys.includes('source_1') &&
    speechKeys.includes('source_2'),
    'Speech result should have 3 sources'
  );
  
  console.log('✅ getSourceKeys() tests passed');
}

export function testAudioArrayToWav() {
  console.log('Testing audioArrayToWav()...');
  
  // Test with 2D array (music)
  const music2D = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];
  const musicBlob = audioArrayToWav(music2D, 44100);
  console.assert(
    musicBlob instanceof Blob,
    'Should return Blob for 2D array'
  );
  console.assert(
    musicBlob.type === 'audio/wav',
    'Should have audio/wav MIME type'
  );
  console.assert(
    musicBlob.size > 44, // WAV header is 44 bytes
    'Should have data beyond header'
  );
  
  // Test with 1D array (speech)
  const speech1D = [0.1, 0.2, 0.3, 0.4, 0.5];
  const speechBlob = audioArrayToWav(speech1D, 8000);
  console.assert(
    speechBlob instanceof Blob,
    'Should return Blob for 1D array'
  );
  console.assert(
    speechBlob.type === 'audio/wav',
    'Should have audio/wav MIME type'
  );
  console.assert(
    speechBlob.size > 44,
    'Should have data beyond header'
  );
  
  console.log('✅ audioArrayToWav() tests passed');
}

// ============================================================================
// API Function Tests (Require Running Backend)
// ============================================================================

export async function testCheckHealth() {
  console.log('Testing checkHealth()...');
  
  try {
    const result = await checkHealth();
    console.assert(
      result.status === 'healthy',
      'Backend should be healthy'
    );
    console.log('✅ checkHealth() test passed');
    return true;
  } catch (error) {
    console.error('❌ checkHealth() test failed:', error);
    return false;
  }
}

export async function testGetAPIInfo() {
  console.log('Testing getAPIInfo()...');
  
  try {
    const result = await getAPIInfo();
    console.assert(
      result.endpoints !== undefined,
      'Should have endpoints property'
    );
    console.assert(
      result.endpoints.speech_separate !== undefined,
      'Should have speech_separate endpoint'
    );
    console.assert(
      result.endpoints.speech_sample !== undefined,
      'Should have speech_sample endpoint'
    );
    console.log('✅ getAPIInfo() test passed');
    return true;
  } catch (error) {
    console.error('❌ getAPIInfo() test failed:', error);
    return false;
  }
}

export async function testProcessSpeechSample() {
  console.log('Testing processSpeechSample()...');
  
  try {
    const result = await processSpeechSample(5.0, false); // No spectrograms for faster test
    
    console.assert(
      result.sample_rate === 8000,
      'Should have 8kHz sample rate'
    );
    console.assert(
      result.num_sources > 0,
      'Should detect at least 1 source'
    );
    console.assert(
      isSpeechSeparation(result),
      'Result should be identified as speech separation'
    );
    
    const keys = getSourceKeys(result);
    console.assert(
      keys.every(k => k.startsWith('source_')),
      'All source keys should start with "source_"'
    );
    
    console.log(`✅ processSpeechSample() test passed (${result.num_sources} sources detected)`);
    return true;
  } catch (error) {
    console.error('❌ processSpeechSample() test failed:', error);
    return false;
  }
}

export async function testSeparateSpeechAudio(file: File) {
  console.log('Testing separateSpeechAudio()...');
  
  try {
    const result = await separateSpeechAudio(file, 5.0);
    
    console.assert(
      result.sample_rate === 8000,
      'Should have 8kHz sample rate'
    );
    console.assert(
      result.num_sources > 0,
      'Should detect at least 1 source'
    );
    console.assert(
      isSpeechSeparation(result),
      'Result should be identified as speech separation'
    );
    
    console.log(`✅ separateSpeechAudio() test passed (${result.num_sources} sources detected)`);
    return true;
  } catch (error) {
    console.error('❌ separateSpeechAudio() test failed:', error);
    return false;
  }
}

// ============================================================================
// Test Runner
// ============================================================================

export async function runAllTests() {
  console.log('='.repeat(80));
  console.log('API CLIENT TEST SUITE');
  console.log('='.repeat(80));
  
  // Utility function tests (no backend required)
  console.log('\n--- Utility Function Tests ---');
  testGetSourceLabel();
  testIsSpeechSeparation();
  testGetSourceKeys();
  testAudioArrayToWav();
  
  // API tests (backend required)
  console.log('\n--- API Function Tests (Backend Required) ---');
  const healthOk = await testCheckHealth();
  const apiInfoOk = await testGetAPIInfo();
  
  if (healthOk && apiInfoOk) {
    await testProcessSpeechSample();
  } else {
    console.warn('⚠️  Skipping remaining tests (backend not available)');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('TESTS COMPLETE');
  console.log('='.repeat(80));
}

// For browser console testing
if (typeof window !== 'undefined') {
  (window as any).apiTests = {
    runAllTests,
    testCheckHealth,
    testGetAPIInfo,
    testProcessSpeechSample,
    testSeparateSpeechAudio,
    testGetSourceLabel,
    testIsSpeechSeparation,
    testGetSourceKeys,
    testAudioArrayToWav,
  };
  
  console.log('API tests available in console: window.apiTests.runAllTests()');
}
