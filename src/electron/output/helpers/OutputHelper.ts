import { BrowserWindow } from "electron"
import { OutputBounds } from "./OutputBounds"
import { OutputIdentify } from "./OutputIdentify"
import { OutputSend } from "./OutputSend"
import { OutputValues } from "./OutputValues"
import { OutputVisibility } from "./OutputVisibility"
import { OutputLifecycle } from "./OutputLifecycle"

export class OutputHelper {
    static outputWindows: { [key: string]: BrowserWindow } = {}

    static Bounds = OutputBounds
    static Identify = OutputIdentify
    static Lifecycle = OutputLifecycle
    static Send = OutputSend
    static Values = OutputValues
    static Visibility = OutputVisibility
}
