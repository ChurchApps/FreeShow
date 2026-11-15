// ----- FreeShow -----
// Svelte app entry point

import * as Sentry from "@sentry/electron/renderer"
import "svelte"
import { set_raf } from "svelte/internal"
import App from "./App.svelte"
import { ERROR_FILTER } from "./utils/common"
import { isComposing } from "./utils/shortcuts"

// error reporting (production only)
// if autoErrorReporting is false, electron reporting will not start and this will fail with an error which is expected
if (import.meta.env.PROD) {
    Sentry.init({
        dsn: "https://5d1069c3cb6faaa6e7ad0d9dc0145361@o4510419080445952.ingest.us.sentry.io/4510419082346496",
        beforeSend(event) {
            // filter out known non-critical errors
            const errorMessage = event.exception?.values?.[0]?.value || ""
            const shouldFilter = ERROR_FILTER.some((filter) => errorMessage.includes(filter))
            return shouldFilter ? null : event
        }
    })
}

// Svelte transitions start at performance.now() but end based on requestAnimationFrame timestamps.
// In output windows the frame timestamps can run hundreds of ms ahead, ending transitions on the first frame.
// Use the same clock for both so transitions always run their full duration.
set_raf((cb: (time: number) => void) => requestAnimationFrame(() => cb(performance.now())))

// While an IME (Chinese/Japanese/Korean input) is composing, the keys typed belong to the IME:
// Enter commits a candidate, Escape cancels it, arrows move through candidates.
// Stop them here (window capture runs before every other listener) so no app shortcut or
// input handler mistakes e.g. a candidate-commit Enter for "submit". The IME itself is unaffected.
// This is the only composition check needed for keydown: no other keydown listener sees these events.
window.addEventListener(
    "keydown",
    (e) => {
        if (isComposing(e)) e.stopImmediatePropagation()
    },
    true
)

const app = new App({ target: document.body })

export default app
