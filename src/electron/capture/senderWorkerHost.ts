import { runSenderWorker } from "./senderWorker"
import { ndiAdapter } from "../ndi/ndiWorker"
import { omtAdapter } from "../omt/omtWorker"

// Entry point of the single sender worker (SenderThread).

runSenderWorker([ndiAdapter, omtAdapter])
