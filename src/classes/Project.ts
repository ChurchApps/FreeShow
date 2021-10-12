import type { ShowRef } from "../../types/Projects"

export class Project {
  name: string
  created: Date = new Date()
  parent: string
  shows: ShowRef[] = []
  constructor(name: string, created: Date, parent: string, shows: ShowRef[]) {
    this.name = name
    this.created = created
    this.parent = parent
    this.shows = shows
  }

  // get shows(): Project {

  // }
}
