export interface Categories {
  [key: string]: Category
}
export interface Category {
  name: string
  icon?: null | string
  path?: string
  default?: boolean
  description?: string
}

export interface TabsObj {
  [key: string]: {
    name: string
    icon: string
  }
}
