export interface Category {
  [key: string]: {
    name: string
    icon: string
    url?: string
    default?: boolean
    description?: string
  }
}

export interface TabsObj {
  [key: string]: {
    name: string
    icon: string
  }
}
