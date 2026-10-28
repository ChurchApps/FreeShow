import { hostname } from "os"

// the output id when a discovered "HOST (name)" source is one of this machine's senders, else ""
export function ownSenderOutput(sourceName: string, senders: { [outputId: string]: { name: string; sender?: boolean } }): string {
    const match = /^(.*) \((.*)\)$/.exec(sourceName || "")
    if (!match || match[1].toLowerCase() !== hostname().toLowerCase()) return ""
    return Object.keys(senders).find((id) => senders[id]?.sender && senders[id].name === match[2]) || ""
}
