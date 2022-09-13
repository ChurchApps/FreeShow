export interface Event {
  id?: string
  type: "event" | "show" | "timer"
  name: string
  color: null | string
  notes?: string
  location?: string
  show?: string
  isoFrom?: string
  isoTo?: string
  fromTime?: string
  toTime?: string
  from: string
  to: string
  time: boolean
  repeat: boolean
  repeatData?: {
    type: "day" | "week" | "month" | "year"
    weekday?: "1" | "2" | "3" | "4" | "5" | "6" | "7"
    ending: "date" | "after" | "never"
    count: number
    endingDate?: string
    afterRepeats?: number
  }
  group?: string
}
