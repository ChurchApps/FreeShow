declare global {
  interface Window {
    api?: any
  }
  // TODO: remove
  interface EventTarget {
    play?: any // VideoStream
    classList?: any // Folder
    closest?: any // Dropdown
  }
}

export type Main = "MAIN"
export type OpenFile = "OPEN_FILE"
export type GetScreens = "GET_SCREENS"
export type Remote = "REMOTE"
export type Stage = "STAGE"

export type ValidChannels = Main | OpenFile | GetScreens | Remote | Stage

export type Data = string | DataObject
export interface DataObject {
  id: string
  data: any
}
