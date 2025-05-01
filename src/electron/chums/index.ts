import { ChumsConnect } from "./ChumsConnect"
import { ChumsImport } from "./ChumsImport"
import { ChumsExport } from "./ChumsExport"
import type { ChumsScopes } from "./types"

export function chumsConnect(scope: ChumsScopes) {
  return ChumsConnect.getInstance().connect(scope)
}

export function chumsDisconnect(scope?: ChumsScopes) {
  return ChumsConnect.getInstance().disconnect(scope)
}

export function chumsLoadServices() {
  return ChumsImport.getInstance().loadServices()
}

export function chumsStartupLoad(scope: ChumsScopes = "plans") {
  if (!ChumsConnect.getInstance().connect(scope)) return
  ChumsExport.getInstance().sendSongsToChums()
  ChumsImport.getInstance().loadServices()
} 