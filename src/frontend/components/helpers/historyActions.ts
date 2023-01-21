import { MAIN } from "../../../types/Channels"
import { send } from "../../utils/request"

// TODO: move history switch to actions

export const historyActions = ({ obj, undo = null }: any) => {
    console.log(obj, undo)

    const actions = {
        SAVE: () => {
            // don't do anything if creating
            if (undo === null) return

            // TODO: confirm this!!
            // if (!get(saved))

            // restore
            let id: string = undo ? obj.oldData.id : obj.newData.id
            send(MAIN, ["READ_SAVED_CACHE"], { id })
        },
    }

    return actions
}
