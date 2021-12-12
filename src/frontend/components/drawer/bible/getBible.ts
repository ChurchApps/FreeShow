import type { Version } from "../../../../types/Scripture"
import type { Categories } from "./../../../../types/Tabs"
import { versions } from "./versions"

export function getBibleVersions(): Categories {
  let versionsList: Categories = {}
  let sorted: Version[] = versions.sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0))
  sorted.forEach((version: Version) => {
    versionsList[version.id] = { name: version.name, icon: "bible", description: version.description || "" }
  })
  return versionsList
}
