export interface Themes {
  name: string
  default?: boolean
  font: any
  colors: any
}

export interface Resolution {
  width: number
  height: number
}

export interface Dictionary {
  [key: string]: {
    [key: string]: string
  }
}
