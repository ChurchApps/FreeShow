export interface Themes {
  name: string
  values: {}
}

export interface Languages {
  [key: LanguageKey]: string
}
export type LanguageKey = string

export interface Resolution {
  width: number
  height: number
}
