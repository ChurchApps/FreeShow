export interface Message {
    channel: string
    data?: any
    id?: string

    name?: string
    path?: string
}

export type Clients = "REMOTE" | "STAGE" | "CONTROLLER" | "OUTPUT_STREAM"
export interface ClientMessage {
    channel: ClientChannels
    id?: DeviceID
    api?: string // API ACTION ID (channel: "API:id")
    data?: any
    send?: boolean
}

type DeviceID = string
type ClientChannels = "API" | "CONNECTION" | "DISCONNECT" | "ERROR" | "DATA" | "PASSWORD" | "ACCESS" | "SWITCH" | "SHOWS" | "LAYOUT" | "SHOWS_CACHE" | "SHOW" | "SHOW_DATA" | "PROJECTS" | "OUT" | "BACKGROUND"

export interface ServerData {
    outputId?: string
    sendAudio?: boolean
}
