export interface Event {
  name: string
  color: null | string
  notes: string
  location: string
  from: Date
  to: Date
  time: boolean
  repeat?: any
  parent?: string
}
