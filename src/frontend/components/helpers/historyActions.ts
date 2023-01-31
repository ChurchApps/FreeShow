import { MAIN } from "../../../types/Channels"
import { stageShows } from "../../stores"
import { send } from "../../utils/request"
import { clone } from "./array"

// TODO: move history switch to actions

export const historyActions = ({ obj, undo = null }: any) => {
    let data: any
    let initialized: boolean = undo === null

    if (obj) {
        console.log(obj, undo)
        data = obj.newData
        if (initialized && !obj.oldData) obj.oldData = clone(obj.newData)
    }

    const actions = {
        SAVE: () => {
            // don't do anything if creating
            if (initialized) return

            // TODO: confirm this!!
            // if (!get(saved))

            // restore
            data = undo ? obj.oldData : obj.newData
            let id: string = data.id
            send(MAIN, ["READ_SAVED_CACHE"], { id })
        },
        STAGE: () => {
            let stageId: string = obj.location.id
            if (!stageId) return error("no stage id")

            stageShows.update((a) => {
                if (obj.location.items?.length) {
                    obj.location.items.forEach((itemId, index) => {
                        let itemData = data[index] || data[0]
                        if (itemData.key) {
                            initialize(a[stageId].items[itemId][itemData.key], { key: "value", index })
                            a[stageId].items[itemId][itemData.key] = itemData.value
                            console.log(a[stageId], itemId, a[stageId].items[itemId][itemData.key])
                        } else if (itemData.data) {
                            initialize(a[stageId].items[itemId], { key: "data", index })
                            a[stageId].items[itemId] = itemData.data
                        } else error("no item data")
                    })
                    return a
                }

                if (data.key) {
                    initialize(a[stageId][data.key], { key: "value" })
                    a[stageId][data.key] = data.value
                } else if (data.data) {
                    initialize(a[stageId], { key: "data" })
                    a[stageId] = data.data
                } else error("no data")
                return a
            })
        },
    }

    function initialize(value: any, { key, index = null }: any) {
        if (!initialized) return
        if (index !== null) {
            obj.oldData[index][key] = value
        } else {
            obj.oldData[key] = value
        }

        // obj.oldData = clone(obj.oldData)
    }

    function error(msg: string = "") {
        console.error(obj.id, "HISTORY ERROR:", msg)
    }

    if (obj) console.info(obj.id, "HISTORY " + (initialized ? "INIT" : undo ? "UNDO" : "REDO") + ":", clone(obj))

    return actions
}
