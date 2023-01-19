import { saved, scripturesCache, showsCache, showsPath } from "../../stores"
import { receiveSTORE } from "../../utils/startup"

export const historyActions = ({ obj, undo = null }: any) => {
    console.log(obj, undo)

    const actions = {
        SAVE: () => {
            // don't do anything if creating or redo ?
            if (!undo) return
            console.log("RESTORE SAVE")

            // TODO: confirm this!!
            // if (!get(saved))

            // restore
            Object.values(obj.oldData).forEach(([key, data]: any) => {
                // don't revert undo/redo history
                if (key === "HISTORY") return
                if (receiveSTORE[key]) receiveSTORE[key](data)
                else if (key === "showsCache") showsCache.set(data)
                else if (key === "scripturesCache") scripturesCache.set(data)
                else if (key === "path") showsPath.set(data)
                else console.log("MISSING HISTORY RESTORE KEY:", key)
            })

            // save to files?
            // window.api.send(STORE, { channel: "SAVE", data: allSavedData })

            saved.set(true)
        },
    }

    return actions
}
