import { get } from "svelte/store"
import { getActiveOutputs, getResolution } from "../components/helpers/output"
import { nextSlideIndividual, previousSlideIndividual } from "../components/helpers/showActions"
import { clearAll } from "../components/output/clear"
import { outputs, paintCache, serverData } from "../stores"
import { draw, drawSettings, drawTool } from "./../stores"

export const receiveCONTROLLER = {
    ACTION: ({ data }) => {
        const actions = {
            next: () => nextSlideIndividual({ key: "ArrowRight" }),
            previous: () => previousSlideIndividual({ key: "ArrowLeft" }),
            clear: () => clearAll(),
            clear_painting: () => clearPainting(),
        }
        if (actions[data.id]) actions[data.id]()
    },
    FOCUS: ({ data }) => {
        if (!data.offset) {
            console.log(data)
            draw.set(null)
            return
        }

        let resolution = getResolution()
        data.offset.x *= resolution.width
        data.offset.y *= resolution.height

        let tool = data.tool || "focus"
        let settings = get(drawSettings)[tool]
        if (settings) {
            data.offset.x -= settings.size / 2
            data.offset.y -= settings.size / 2
        }

        draw.set(data.offset)
        drawTool.set(tool)

        if (tool === "paint") paintCache.set([{ x: 0, y: 0, size: 0, color: "white" }])
    },
    GET_OUTPUT_ID: () => {
        return { channel: "GET_OUTPUT_ID", data: get(serverData)?.output_stream?.outputId || getActiveOutputs(get(outputs), false, true, true)[0] }
    },
}

function clearPainting() {
    paintCache.set([])

    drawSettings.update((a: any) => {
        if (!a.paint) a.paint = { color: "#ffffff", size: 10, threed: false, dots: false, hold: true }
        a.paint.clear = true
        return a
    })
    setTimeout(() => {
        drawSettings.update((a: any) => {
            delete a.paint.clear
            return a
        })
    }, 50)
}

// export async function sendBackgroundToController(outputId: string, updater = get(outputs)) {
//     let currentOutput = updater[outputId]?.out
//     let path = currentOutput?.background?.path || ""

//     if (!path) {
//         send(CONTROLLER, ["BACKGROUND"], { path: "" })
//         return
//     }

//     let base64path = await getBase64Path(path)

//     let bg = clone({ path: base64path, mediaStyle: get(media)[path] || {} })

//     send(CONTROLLER, ["BACKGROUND"], bg)
//     return
// }
