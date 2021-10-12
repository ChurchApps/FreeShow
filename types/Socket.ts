import type { Projects, Folders, ShowRef } from "./Projects"
import type { LanguageKey } from "./Settings"
import type { ID, Show } from "./Show"

export interface RemoteData {
  channel?: RemoteChannels
  id: DeviceID
  data: {
    id: ID
  }
}
export interface RemoteInitialize {
  id: DeviceID
  channel: RemoteChannels
  data: {
    name: string
    lang: LanguageKey
    activeProject: null | ID
    activeShow: null | ShowRef
    projects: Projects
    folders: Folders
  }
}
export interface RemoteShow {
  id: ID
  channel: RemoteChannels
  data: Show
}

type DeviceID = string
type RemoteChannels = "REQUEST" | "DATA" | "GET_SHOW"

export interface MainData {
  channel: MainChannels
  data?: string
}
type MainChannels = "GET_OS"
