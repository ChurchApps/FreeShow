// AI AUTO SCRIPTURE
// the scripture feature on top of the generic speech-to-text layer (ai/stt):
// starts detection in the electron process, receives detected references back & projects/suggests them
//
// this is the feature's entry point: importing it installs the session & override watchers
// (side-effect imports below), and the public surface re-exports from the focused modules

import "./session"
import "./manualOverride"

export { aiScriptureErrorText } from "./errors"
export { dismissSuggestion, handleDetection } from "./detections"
export { resumeAutoProjection } from "./manualOverride"
export { projectDetection, restorePrevious, showInDrawer } from "./projection"
export { startAiScriptureListening, stopAiScriptureListening } from "./session"
export { refreshSessionLlm } from "./sessionLlm"
export { executeScriptureCommand } from "./voiceCommands"
