import { BrowserWindow } from "electron"
import { OutputBounds } from "./OutputBounds"
import { OutputIdentify } from "./OutputIdentify"
import { OutputSend } from "./OutputSend"
import { OutputValues } from "./OutputValues"
import { OutputVisibility } from "./OutputVisibility"

export class OutputHelper {
    static outputWindows: { [key: string]: BrowserWindow } = {}
    static Identify = OutputIdentify
    static Send = OutputSend
    static Bounds = OutputBounds
    static Values = OutputValues
    static Visibility = OutputVisibility
}