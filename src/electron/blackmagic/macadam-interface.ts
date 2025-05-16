// File: macadam.d.ts
// Add this to extend the macadam typings if they're not already defined

declare module 'macadam' {
  export interface PlaybackChannel {
    schedule(frame: {
      video: Buffer;
      audio: Buffer;
      sampleFrameCount: number;
      time: number;
    }): void;
    start(options: { startTime: number }): void;
    stop(): void;
    bufferedFrames(): number;
    hardwareTime(): { hardwareTime: number } | null;
    scheduledTime(): { streamTime: number } | null;
    lastPlayedFrameTime?(): number;
    onFramePlayed?(callback: (frameInfo: { time: number }) => void): void;
  }

  export interface CaptureChannel {
    frame(): Promise<CaptureFrame>;
    stop(): void;
    frameRate: [number, number];
    width: number;
    height: number;
  }

  export interface CaptureFrame {
    video: {
      type: string;
      width: number;
      height: number;
      rowBytes: number;
      frameTime: number;
      frameDuration: number;
      data: Buffer;
      hasNoInputSource: boolean;
      timecode: string | false;
      userbits: number;
      hardwareRefFrameTime: number;
      hardwareRefFrameDuration: number;
    };
    audio: {
      type: string;
      sampleFrameTime: number;
      data: Buffer;
    };
  }

  // Add any additional constants and functions from macadam
  export const bmdModeNTSC: number;
  export const bmdModeNTSC2398: number;
  export const bmdModePAL: number;
  export const bmdModeHD720p50: number;
  export const bmdModeHD720p5994: number;
  export const bmdModeHD720p60: number;
  export const bmdModeHD1080p2398: number;
  export const bmdModeHD1080p24: number;
  export const bmdModeHD1080p25: number;
  export const bmdModeHD1080p2997: number;
  export const bmdModeHD1080p30: number;
  export const bmdModeHD1080p50: number;
  export const bmdModeHD1080p5994: number;
  export const bmdModeHD1080p6000: number;
  export const bmdModeHD1080i50: number;
  export const bmdModeHD1080i5994: number;
  export const bmdModeHD1080i6000: number;
  export const bmdMode2k2398: number;
  export const bmdMode2k24: number;
  export const bmdMode2k25: number;
  export const bmdMode2kDCI2398: number;
  export const bmdMode2kDCI24: number;
  export const bmdMode2kDCI25: number;
  export const bmdMode2kDCI2997: number;
  export const bmdMode2kDCI30: number;
  export const bmdMode2kDCI50: number;
  export const bmdMode2kDCI5994: number;
  export const bmdMode2kDCI60: number;
  export const bmdMode4K2160p2398: number;
  export const bmdMode4K2160p24: number;
  export const bmdMode4K2160p25: number;
  export const bmdMode4K2160p2997: number;
  export const bmdMode4K2160p30: number;
  export const bmdMode4K2160p50: number;
  export const bmdMode4K2160p5994: number;
  export const bmdMode4K2160p60: number;
  export const bmdMode4kDCI2398: number;
  export const bmdMode4kDCI24: number;
  export const bmdMode4kDCI25: number;
  export const bmdMode4kDCI2997: number;
  export const bmdMode4kDCI30: number;
  export const bmdMode4kDCI50: number;
  export const bmdMode4kDCI5994: number;
  export const bmdMode4kDCI60: number;
  export const bmdMode8K4320p2398: number;
  export const bmdMode8K4320p24: number;
  export const bmdMode8K4320p25: number;
  export const bmdMode8K4320p2997: number;
  export const bmdMode8K4320p30: number;
  export const bmdMode8K4320p50: number;
  export const bmdMode8K4320p5994: number;
  export const bmdMode8K4320p60: number;
  export const bmdMode8kDCI2398: number;
  export const bmdMode8kDCI24: number;
  export const bmdMode8kDCI25: number;
  export const bmdMode8kDCI2997: number;
  export const bmdMode8kDCI30: number;
  export const bmdMode8kDCI50: number;
  export const bmdMode8kDCI5994: number;
  export const bmdMode8kDCI60: number;

  export const bmdFormat8BitYUV: number;
  export const bmdFormat10BitYUV: number;
  export const bmdFormat8BitARGB: number;
  export const bmdFormat8BitBGRA: number;
  export const bmdFormat10BitRGB: number;
  export const bmdFormat12BitRGB: number;
  export const bmdFormat12BitRGBLE: number;
  export const bmdFormat10BitRGBXLE: number;
  export const bmdFormat10BitRGBX: number;

  export const bmdAudioSampleRate48kHz: number;
  export const bmdAudioSampleType16bitInteger: number;

  export function getFirstDevice(): string | undefined;
  export function getDeviceInfo(): any;
  export function getDeviceConfig(deviceIndex: number): any;
  export function setDeviceConfig(config: any): void;
  export function capture(options: any): Promise<CaptureChannel>;
  export function playback(options: any): Promise<PlaybackChannel>;
}
