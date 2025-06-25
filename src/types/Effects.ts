export interface Effects {
    [key: string]: Effect
}

export interface Effect {
    name: string
    isDefault?: boolean
    displayDuration?: number
    placeUnderSlide?: boolean
    color: string | null
    // options
    style: string
    background: string
    opacity?: number

    items: EffectItem[]
}

// | "rain_screen"
export type EffectType =
    | "circle"
    | "rectangle"
    | "triangle"
    | "wave"
    | "bubbles"
    | "stars"
    | "galaxy"
    | "rain"
    | "snow"
    | "sun"
    | "lens_flare"
    | "spotlight"
    | "aurora"
    | "bloom"
    | "fog"
    | "city"
    | "rays"
    | "fireworks"
    | "cycle"
    | "grass"
    | "mountains"
    | "lightning"
    | "rainbow"
    | "asset"
export interface EffectItem<T extends EffectType = EffectType> {
    type: T
    hidden?: boolean
    cropped?: { top: number; right: number; bottom: number; left: number }
    x?: number
    y?: number
}

///

export type EffectFunction = (item: EffectItem, deltaTime: number) => void
export type EffectInit = (item: EffectItem) => void

export interface EffectDefinition {
    init?: EffectInit
    render: EffectFunction
}

///

export type Side = "bottom" | "top" | "left" | "right"

/// ITEMS ///

// export interface ShapeItem extends EffectItem<"shape"> {
//     shape: "circle" | "rectangle" | "triangle"
//     size: number
//     rotationSpeed: number // degrees per frame or per second scaled by deltaTime
//     color?: string
// }

export interface WaveItem extends EffectItem<"wave"> {
    amplitude: number
    wavelength: number
    speed: number
    color: string
    offset: number
    side?: Side
    phase?: number
}

export interface BubbleItem extends EffectItem<"bubbles"> {
    count: number
    size: number
    maxSizeVariation: number
    pulseSpeed?: number
    speed: number
    // color range
}

export interface StarItem extends EffectItem<"stars"> {
    count: number
    size: number
    speed?: number
}

export interface GalaxyItem extends EffectItem<"galaxy"> {
    count: number // Total number of stars
    size: number // Base size of stars
    swirlStrength: number // Spiral curve factor
    rotationSpeed: number // Rotation speed
    armCount?: number // Number of spiral arms
    nebula?: boolean // Draw gas clouds
    colors?: string[] // Star color palette
}

export interface RainItem extends EffectItem<"rain"> {
    count: number
    speed: number
    length: number
    width: number
    color?: string
}

// interface RainScreenItem extends EffectItem<"rain_screen"> {
//     count: number
//     minRadius: number
//     maxRadius: number
//     color?: string
//     gravity?: number
//     smear?: boolean
// }

export interface SnowItem extends EffectItem<"snow"> {
    count: number
    size: number
    speed: number
    drift?: number // horizontal sway
    color?: string
}

export interface ShapeItem extends EffectItem {
    thickness: number
    speed: number
    hollow?: boolean
    shadow?: number
    angle: number
    color: string
}
export interface CircleItem extends ShapeItem {
    radius: number
    gap?: number
}
export interface RectangleItem extends ShapeItem {
    width: number
    height: number
}
export interface TriangleItem extends ShapeItem {
    size: number
}

export interface SunItem extends EffectItem<"sun"> {
    radius: number // sun core radius
    rayCount: number // number of rays
    rayLength: number // length of rays
    rayWidth: number // width of rays
    speed?: number
    orbitRadius?: number
    orbitAngle?: number
    color?: string
}

export interface LensFlareItem extends EffectItem<"lens_flare"> {
    size: number
    radius: number
    flareDiscNum?: number
}

export interface SpotlightItem extends EffectItem<"spotlight"> {
    length: number // length of the light cone (height of the triangle)
    baseWidth: number // width of the base of the triangle
    color: string // base color of the spotlight (glow)
    swayAmplitude: number // max horizontal sway (in pixels)
    swaySpeed: number // sway speed in radians per second
    angle?: number // optional rotation angle (default 0 means pointing down)
}

export interface AuroraItem extends EffectItem<"aurora"> {
    bandCount: number
    colorStops: string[]
    amplitude: number
    wavelength: number
    speed: number
    opacity?: number
    offset?: number
}

export interface BloomItem extends EffectItem<"bloom"> {
    blobCount?: number
    blurAmount?: number
    speed?: number
}

export interface FogItem extends EffectItem<"fog"> {
    count: number // number of fog clouds
    size: number // base size of each fog cloud
    speed: number // horizontal movement speed
    opacity?: number // default: 0.1
    blur?: number // default: 50
    spread?: number
    offset?: number
}

export interface CityItem extends EffectItem<"city"> {
    offset?: number
    count: number
    width: number
    height: number
    color?: string
    windowColor?: string
    night?: boolean
    flickerSpeed?: number // 0 to 1 (chance per window per frame to toggle)
}

export interface RayItem extends EffectItem<"rays"> {
    speed: number
    color_1: string
    color_2: string
    numRays?: number
}

export interface FireworkItem extends EffectItem<"fireworks"> {
    offset?: number
    size: number
    count: number
    speed: number
}

export interface CycleItem extends EffectItem<"cycle"> {
    speed: number
    phases: { stop: number; color: string }[]
}

export interface GrassItem extends EffectItem<"grass"> {
    offset?: number
    count: number
    height: number
    speed?: number
    width: number
    color?: string
    windStrength?: number // how much the grass sways (0-1, default: 0.5)
    heightVariation?: number // height variation (0-1, default: 0.3)
}

export interface LightningItem extends EffectItem<"lightning"> {
    frequency: number // average strikes per second
    duration: number // flash duration in frames
    color?: string
}

export interface RainbowItem extends EffectItem<"rainbow"> {
    offset?: number
    bandWidth?: number
}

export interface AssetItem extends EffectItem<"asset"> {
    path: string
    size: number
}
