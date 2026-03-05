export interface DeviceData {
    modelName: string // "Intensity Extreme"
    displayName: string // "Intensity Extreme"
    vendorName: string // "Blackmagic"
    deviceHandle: string // "54:00000000:00360600"
    hasSerialPort: boolean // false
    topologicalID: number // 3540480
    numberOfSubDevices: number // 1
    subDeviceIndex: number // 0
    maximumAudioChannels: number // 2
    maximumAnalogAudioInputChannels: number // 2
    maximumAnalogAudioOutputChannels: number // 2
    supportsInputFormatDetection: boolean // false
    hasReferenceInput: boolean // false
    supportsFullDuplex: boolean // false
    supportsExternalKeying: boolean // false
    supportsInternalKeying: boolean // false
    supportsHDKeying: boolean // false
    hasAnalogVideoOutputGain: boolean // true
    canOnlyAdjustOverallVideoOutputGain: boolean // true
    videoInputGainMinimum: number // -1.8
    videoInputGainMaximum: number // 1.8
    videoOutputGainMinimum: number // -1.8
    videoOutputGainMaximum: number // 1.8
    hasVideoInputAntiAliasingFilter: boolean // false
    hasLinkBypass: boolean // false
    supportsClockTimingAdjustment: boolean // false
    supportsFullFrameReferenceInputTimingOffset: boolean // false
    supportsSMPTELevelAOutput: boolean // false
    supportsDualLinkSDI: boolean // false
    supportsQuadLinkSDI: boolean // false
    supportsIdleOutput: true
    hasLTCTimecodeInput: boolean // false
    supportsDuplexModeConfiguration: boolean // false
    supportsHDRMetadata: boolean // false
    supportsColorspaceMetadata: boolean // false
    deviceInterface: string // "Thunderbolt"
    deviceSupports: Array<"Capture" | "Playback">
    controlConnections: any[] // []
    videoInputConnections: Array<"HDMI" | "Component" | "Composite" | "S-Video">
    audioInputConnections: Array<"Embedded" | "Analog" | "AnalogRCA">
    audioInputRCAChannelCount: number // 2
    audioInputXLRChannelCount: number // 0
    videoOutputConnections: Array<"HDMI" | "Component" | "Composite" | "S-Video">
    audioOutputConnections: Array<"Embedded" | "AESEBU" | "Analog" | "AnalogRCA">
    audioOutputRCAChannelCount: number // 2
    audioOutputXLRChannelCount: number // 0
    inputDisplayModes: {
        name: string // "NTSC" / "1080p29.97" / "1080p30" / "1080i50" / "720p60"
        width: number // 720 / 1920
        height: number // 486 / 1080
        frameRate: [number, number] // [ 1001, 30000 ]
        videoModes: string[] // [ "8-bit YUV", "10-bit YUV" ]
    }[]
}

export interface DeviceConfig {
    type: "configuration"
    deviceIndex: number
    swapSerialRxTx?: undefined | null | boolean
    HDMI3DPackingFormat?: any
    bypass?: undefined | null | boolean
    fieldFlickerRemoval?: undefined | null | boolean
    HD1080p24ToHD1080i5994Conversion?: undefined | null | boolean
    videoOutputMode?: number // 1853125475 (intToBMCode() > 'ntsc')
    defaultVideoModeOutputFlags?: number // 0
    videoInputConnection?: number // 1
    deviceInformationLabel?: string
    // and more...
}

// export interface CaptureData {
//     type: string // 'capture'
//     displayModeName: string // '1080i50'
//     width: number // 1920
//     height: number // 1080
//     fieldDominance: string // 'upperFieldFirst'
//     frameRate: [number, number] // [ 1000, 25000 ]
//     pixelFormat: string // '8-bit YUV'
//     audioEnabled: boolean // true
//     sampleRate: number // 48000
//     sampleType: number // 16
//     channels: number // 2
//     pause: any // [Function: pause]
//     stop: any // [Function: stop]
//     frame: any // [Function: frame]
//     deckLinkInput: any // [External]
// }

// export interface CaptureFrame {
//     type: "frame"
//     video: VideoFrame
//     audio: AudioFrame
// }

// interface VideoFrame {
//     type: string // 'videoFrame'
//     width: number // 1920
//     height: number // 1080
//     rowBytes: number // 3840
//     frameTime: number // 200000
//     frameDuration: number // 1000
//     data: ArrayBuffer // <Buffer 80 10 80 10 80 10 80 10 80 ... >
//     hasNoInputSource: boolean // true
//     timecode: string // '10:11:12:13' (set to false when not available)
//     userbits: number // 0 (timecode userbits)
//     hardwareRefFrameTime: number // 17379742688
//     hardwareRefFrameDuration: number // 1000
// }

// interface AudioFrame {
//     type: "audioPacket"
//     sampleFrameTime: number // 1920
//     data: ArrayBuffer // <Buffer 00 a0 00 b0 00 c0 00 d0 ... >
// }
