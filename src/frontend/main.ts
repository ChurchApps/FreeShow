// ----- FreeShow -----
// Svelte app entry point

import * as Sentry from "@sentry/electron/renderer"
import "svelte"
import App from "./App.svelte"
import { ERROR_FILTER } from "./utils/common"

// error reporting
if (process.env.NODE_ENV === "production") {
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

const app = new App({ target: document.body })

export default app
