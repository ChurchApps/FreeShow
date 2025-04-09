import type { ContextMenuParams } from "electron"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"
import { getMainWindow } from ".."

export function spellcheck(params: ContextMenuParams) {
    const misspelled = params.misspelledWord
    const suggestions = params.dictionarySuggestions

    if (!misspelled || !suggestions.length) return

    sendToMain(ToMain.SPELL_CHECK, { misspelled, suggestions })
}

export function correctSpelling(data: { addToDictionary?: string; fixSpelling?: string }) {
    if (data.addToDictionary) {
        getMainWindow()?.webContents.session.addWordToSpellCheckerDictionary(data.addToDictionary)
        return
    }

    if (data.fixSpelling) {
        getMainWindow()?.webContents.replaceMisspelling(data.fixSpelling)
        return
    }
}
