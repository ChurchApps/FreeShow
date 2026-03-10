/**
 * TypeScript type definitions for Blackmagic Design devices
 * Based on the macadam library interface
 */

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
    deviceSupports: ("Capture" | "Playback")[]
    controlConnections: any[] // []
    videoInputConnections: ("HDMI" | "Component" | "Composite" | "S-Video")[]
    audioInputConnections: ("Embedded" | "Analog" | "AnalogRCA")[]
    audioInputRCAChannelCount: number // 2
    audioInputXLRChannelCount: number // 0
    videoOutputConnections: ("HDMI" | "Component" | "Composite" | "S-Video")[]
    audioOutputConnections: ("Embedded" | "AESEBU" | "Analog" | "AnalogRCA")[]
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
}
