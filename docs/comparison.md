# Signal Equalizer - Mode Comparison

This document compares the different equalizer modes available in the Signal Equalizer application.

## Overview

The Signal Equalizer provides three preset modes, each optimized for different types of audio content:
- **Musical**: Optimized for musical instruments
- **Animals**: Optimized for animal sounds
- **Voices**: Optimized for human speech

## Frequency Bands

All modes use the same seven frequency bands:

| Band | Label | Frequency | Range |
|------|-------|-----------|-------|
| 1 | Sub Bass | 60 Hz | 20-100 Hz |
| 2 | Bass | 150 Hz | 100-250 Hz |
| 3 | Low Mid | 400 Hz | 250-500 Hz |
| 4 | Mid | 1000 Hz | 500-2000 Hz |
| 5 | High Mid | 3000 Hz | 2000-4000 Hz |
| 6 | Presence | 6000 Hz | 4000-8000 Hz |
| 7 | Brilliance | 12000 Hz | 8000-20000 Hz |

## Mode Characteristics

### Musical Mode

**Purpose**: Enhances musical content with emphasis on harmonics and clarity.

**Gain Settings**:
- Sub Bass: +2 dB (warm low end)
- Bass: +3 dB (rich bass foundation)
- Low Mid: +1 dB (body and warmth)
- Mid: 0 dB (natural)
- High Mid: +2 dB (clarity)
- Presence: +4 dB (air and detail)
- Brilliance: +3 dB (sparkle)

**Best for**: 
- Musical instruments (piano, guitar, drums)
- Full orchestral recordings
- Pop and rock music
- Any content where musical clarity is important

### Animals Mode

**Purpose**: Emphasizes both low rumbles and high-frequency details typical of animal vocalizations.

**Gain Settings**:
- Sub Bass: +4 dB (deep growls and rumbles)
- Bass: +3 dB (low-frequency calls)
- Low Mid: -1 dB (reduced muddiness)
- Mid: +1 dB (slight enhancement)
- High Mid: +3 dB (chirps and calls)
- Presence: +5 dB (bird songs, insect sounds)
- Brilliance: +6 dB (ultrasonic-range details)

**Best for**:
- Wildlife recordings
- Pet sounds
- Nature documentaries
- Bioacoustic analysis

### Voices Mode

**Purpose**: Optimized for human speech intelligibility and clarity.

**Gain Settings**:
- Sub Bass: -3 dB (reduce rumble)
- Bass: -1 dB (reduce boominess)
- Low Mid: +2 dB (warmth and body)
- Mid: +4 dB (speech fundamentals)
- High Mid: +5 dB (consonant clarity)
- Presence: +3 dB (articulation)
- Brilliance: +1 dB (slight air)

**Best for**:
- Podcasts
- Audiobooks
- Voice recordings
- Conference calls
- Speech analysis

## Technical Comparison

### Frequency Response Curves

```
Gain (dB)
  +6 |                                    A
  +5 |                             A      |
  +4 |                M      V     |   A  M
  +3 |          M     |      |  M  |   |  |
  +2 |     M    |  M  |   M  |  |  |   |  |
  +1 |     |    |  |  |   |  |  |  |   |  |  M
   0 |_____|____|__M__|___|__|__|__|___|__|__|___
  -1 |                |   A  |           
  -2 |                          
  -3 |                     V
     |_____|____|_____|___|__|__|__|___|__|__|___
       60  150  400  1k  3k 6k 12k
                 Frequency (Hz)

Legend: M = Musical, A = Animals, V = Voices
```

### Use Case Matrix

|                    | Musical | Animals | Voices |
|--------------------|---------|---------|--------|
| Low Freq Emphasis  | Medium  | High    | Low    |
| Mid Freq Emphasis  | Low     | Medium  | High   |
| High Freq Emphasis | High    | Very High| Medium|
| Speech Clarity     | Low     | Low     | Very High |
| Music Quality      | Very High| Low    | Low    |
| Natural Sounds     | Medium  | Very High| Low   |

## Customization

While these presets provide excellent starting points, users can:
1. Select a preset mode
2. Fine-tune individual bands to taste
3. Create custom equalizer curves for specific content

Each band can be adjusted ±12 dB in 0.5 dB increments.

## Technical Implementation

The equalizer uses:
- **Filter Type**: Peaking EQ (2nd order IIR)
- **Q Factor**: 1.0 (moderate bandwidth)
- **Processing**: Real-time in Web Audio API
- **Latency**: <10ms typical

## Recommendations

### Choosing the Right Mode

1. **Start with the preset** that matches your content type
2. **Load your audio file** and play it
3. **A/B compare** with the flat/default setting
4. **Fine-tune** individual bands if needed
5. **Observe the waveform and spectrogram** for visual feedback

### Common Adjustments

- **Too boomy**: Reduce Bass and Low Mid bands
- **Lacks clarity**: Increase High Mid and Presence
- **Too harsh**: Reduce Presence and Brilliance
- **Too thin**: Increase Bass and Low Mid
- **Muffled**: Increase High Mid, Presence, and Brilliance

## Conclusion

Each mode is carefully crafted for its intended use case. The Musical mode prioritizes harmonic richness, the Animals mode emphasizes frequency extremes, and the Voices mode focuses on speech intelligibility. Understanding these differences helps users make informed decisions about which mode to use for their specific audio content.
