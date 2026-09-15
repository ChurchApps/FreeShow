import { runSenderWorker } from "./senderWorker"
import { ndiAdapter } from "../ndi/ndiWorker"
import { omtAdapter } from "../omt/omtWorker"

// The one sender worker. A shared texture can only be opened by a single thread, so the outputs that
// share a render must send from the same worker whatever protocol each of them speaks.

runSenderWorker([ndiAdapter, omtAdapter])
