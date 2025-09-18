import type { Main, MainSendPayloads } from "../../types/IPC/Main"
import { stores } from "../data/store"
import { ChumsConnect } from "./ChumsConnect"
import { ChumsExport } from "./ChumsExport"
import { ChumsImport } from "./ChumsImport"
import type { ChumsScopes } from "./types"

export function chumsDisconnect(scope?: ChumsScopes) {
    return ChumsConnect.disconnect(scope)
}

export function chumsLoadServices() {
    return ChumsImport.loadServices()
}

export function chumsStartupLoad(scope: ChumsScopes = "plans", data: MainSendPayloads[Main.CHUMS_STARTUP_LOAD]) {
    if (!stores.ACCESS.get(`chums_${scope}`)) return
    ChumsConnect.connect(scope).then((connected) => {
        if (!connected) return
        ChumsExport.sendSongsToChums(data)
        ChumsImport.loadServices()
    })
}
