import { ChumsConnect } from "./ChumsConnect"
import { ChumsImport } from "./ChumsImport"
import { ChumsExport } from "./ChumsExport"
import type { ChumsScopes } from "./types"

export function chumsConnect(scope: ChumsScopes) {
  return ChumsConnect.connect(scope)
}

export function chumsDisconnect(scope?: ChumsScopes) {
  return ChumsConnect.disconnect(scope)
}

export function chumsLoadServices() {
  return ChumsImport.loadServices()
}

export function chumsStartupLoad(scope: ChumsScopes = "plans") {
  if (!ChumsConnect.connect(scope)) return
  ChumsExport.sendSongsToChums()
  ChumsImport.loadServices()
} 