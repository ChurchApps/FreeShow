import { ChumsConnect } from "./ChumsConnect"
import { ChumsImport } from "./ChumsImport"
import { ChumsExport } from "./ChumsExport"
import type { ChumsScopes } from "./types"
import { stores } from "../data/store"

export function chumsConnect(scope: ChumsScopes) {
  return ChumsConnect.connect(scope)
}

export function chumsDisconnect(scope?: ChumsScopes) {
  return ChumsConnect.disconnect(scope)
}

export function chumsLoadServices() {
  return ChumsImport.loadServices()
}

export async function chumsStartupLoad(scope: ChumsScopes = "plans") {
  if (!stores.ACCESS.get(`chums_${scope}`)) return
  const connected = await ChumsConnect.connect(scope)
  if (!connected) return
  await ChumsExport.sendSongsToChums()
  await ChumsImport.loadServices()
}
