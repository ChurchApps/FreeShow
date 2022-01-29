export interface Event {
  name: string
  color: null | string
  notes: string
  location: string
  from: number
  to: number
  time: boolean
  repeat?: any
  parent?: string
}
