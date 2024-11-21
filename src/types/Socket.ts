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
}

type DeviceID = string
type ClientChannels = "API" | "CONNECTION" | "DISCONNECT" | "ERROR" | "DATA" | "PASSWORD" | "ACCESS" | "SWITCH" | "SHOWS" | "SHOWS_CACHE" | "SHOW" | "SLIDES" | "PROJECTS" | "OUT" | "BACKGROUND"

export interface MainData {
    channel: MainChannels
    data?: any
}
type MainChannels = "GET_OS" | "VERSION" | "OUTPUT" | "DISPLAY" | "GET_PATHS" | "MENU" | "SHOWS_PATH"
