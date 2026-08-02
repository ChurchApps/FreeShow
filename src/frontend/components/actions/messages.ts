import { get } from "svelte/store"
import type { Message, Overlay } from "../../../types/Show"
import { messages, outLocked, overlays } from "../../stores"
import { keysToID } from "../helpers/array"
import { setOutput } from "../helpers/output"
import { clearOverlay } from "../output/clear"
import { sortByClosestMatch } from "./apiHelper"

// MESSAGES
// Templated audience alerts (like ProPresenter "Messages"): e.g. "Parent of child {{number}}, please come to the lobby".
// A message is defined once (Messages drawer tab / "message" popup) and triggered live with per-trigger {{token}} values,
// from the drawer or the trigger_message / clear_message API (also usable as action steps).
// WHY it renders this way: a triggered message is materialized as a transient Overlay (marked with fromMessageId)
// so it rides the EXISTING overlay output layer (transitions, multi-output, stage mirroring) - zero new output plumbing.
// The materialized overlay is hidden in the overlay drawer and deleted again on clear.

// overlay id used for a triggered message (stable per message, so re-triggering replaces instead of stacking)
const messageOverlayId = (messageId: string) => `message_${messageId}`

// default "lower third" position/style if the message has no custom style (matches createData.ts lowerThird)
const DEFAULT_MESSAGE_STYLE = "top: 820px;left: 50px;width: 1820px;height: 220px;"
const DEFAULT_MESSAGE_TEXT_STYLE = "font-size: 70px;font-weight: bold;"

// auto-clear timeouts for messages with a displayDuration
const messageTimeouts: { [key: string]: NodeJS.Timeout } = {}

// replace {{token}} fill-ins with trigger values (falling back to the message's stored defaults)
// single-brace {dynamic values} are left untouched so they keep updating live at render time (TextboxLines)
export function replaceMessageTokens(text: string, message: Message, values: { [key: string]: string } = {}) {
    return text.replace(/{{\s*([^{}]+?)\s*}}/g, (match, token: string) => values[token] ?? message.tokens?.[token] ?? match)
}

// build the transient overlay for a triggered message (one text item, one line per \n)
function materializeMessageOverlay(messageId: string, message: Message, values: { [key: string]: string } = {}): Overlay {
    const text = replaceMessageTokens(message.text || "", message, values)
    const textStyle = message.textStyle || DEFAULT_MESSAGE_TEXT_STYLE

    return {
        name: message.name,
        color: message.color || null,
        category: null,
        fromMessageId: messageId,
        items: [
            {
                style: message.style || DEFAULT_MESSAGE_STYLE,
                align: "",
                textFit: "shrinkToFit",
                lines: text.split("\n").map((line) => ({ align: "", text: [{ value: line, style: textStyle }] }))
            }
        ]
    }
}

export function triggerMessage(messageId: string, values: { [key: string]: string } = {}) {
    if (get(outLocked)) return
    const message = get(messages)[messageId]
    if (!message) return

    const overlayId = messageOverlayId(messageId)

    // (re)materialize so new token values replace a currently shown instance
    overlays.update((a) => {
        a[overlayId] = materializeMessageOverlay(messageId, message, values)
        return a
    })

    setOutput("overlays", overlayId, false, "", true)

    // auto clear after displayDuration seconds (re-trigger restarts the countdown)
    if (messageTimeouts[messageId]) clearTimeout(messageTimeouts[messageId])
    if (Number(message.displayDuration)) {
        messageTimeouts[messageId] = setTimeout(() => clearMessage(messageId), Number(message.displayDuration) * 1000)
    }
}

export function triggerMessageByName(name: string, values: { [key: string]: string } = {}) {
    const sortedMessages = sortByClosestMatch(keysToID(get(messages)), name)
    const messageId = sortedMessages[0]?.id
    if (!messageId) return

    triggerMessage(messageId, values)
}

export function clearMessage(messageId: string) {
    if (messageTimeouts[messageId]) {
        clearTimeout(messageTimeouts[messageId])
        delete messageTimeouts[messageId]
    }

    const overlayId = messageOverlayId(messageId)
    clearOverlay(overlayId)

    // remove the transient overlay again (it only exists while the message is shown)
    // slight delay so the overlay layer can play its clearing transition before the data disappears
    setTimeout(() => {
        overlays.update((a) => {
            delete a[overlayId]
            return a
        })
    }, 500)
}

// is this message currently materialized (= shown or clearing)?
export function isMessageActive(messageId: string) {
    return !!get(overlays)[messageOverlayId(messageId)]
}

// API getter (get_messages) - same list shape as getVariables()
export function getMessages() {
    return Object.entries(get(messages) || {}).map(([id, message]) => ({
        id,
        name: message.name || "",
        text: message.text || "",
        tokens: Object.keys(message.tokens || {}),
        displayDuration: message.displayDuration || 0,
        active: isMessageActive(id)
    }))
}
