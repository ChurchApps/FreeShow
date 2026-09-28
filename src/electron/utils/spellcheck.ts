import type { ContextMenuParams } from "electron"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"
import { getMainWindow } from ".."
import { config } from "../data/store"

export function spellcheck(params: ContextMenuParams) {
    const misspelled = params.misspelledWord
    const suggestions = params.dictionarySuggestions

    if (!misspelled || !suggestions.length) return

    sendToMain(ToMain.SPELL_CHECK, { misspelled, suggestions })
}

// The app locale ("es", "pt-BR", "nb") has to be matched against the list of dictionaries
// Chromium actually ships, which uses codes like "es-ES" or "pt-BR".
export function findSpellCheckerLanguage(locale: string, available: string[]) {
    if (!locale || !available.length) return ""

    const wanted = locale.replace(/_/g, "-").toLowerCase()
    const base = wanted.split("-")[0]

    return available.find((lang) => lang.toLowerCase() === wanted) || available.find((lang) => lang.toLowerCase().split("-")[0] === base) || ""
}

// remembered so a language change and an on/off toggle do not undo each other
let currentLocale = ""

// Chromium downloads the dictionary for the chosen language on its own the first time it is used,
// and then underlines misspelled words in the editor.
export function setSpellCheckerLanguage(locale?: string, isEnabled?: boolean) {
    if (locale !== undefined) currentLocale = locale
    if (isEnabled !== undefined) config.set("spellcheck", isEnabled)

    const session = getMainWindow()?.webContents.session
    if (!session) return

    const enabled = config.get("spellcheck") !== false
    session.setSpellCheckerEnabled(enabled)
    // macOS uses the system spell checker, where the language cannot be set from here
    if (!enabled || process.platform === "darwin") return

    const language = findSpellCheckerLanguage(currentLocale, session.availableSpellCheckerLanguages)
    if (!language) {
        console.warn("No spell checking dictionary for:", currentLocale)
        return
    }

    session.setSpellCheckerLanguages([language])
}

export function correctSpelling(data: { addToDictionary?: string; fixSpelling?: string; enabled?: boolean }) {
    if (data.enabled !== undefined) {
        setSpellCheckerLanguage(undefined, data.enabled)
        return
    }

    if (data.addToDictionary) {
        getMainWindow()?.webContents.session.addWordToSpellCheckerDictionary(data.addToDictionary)
        return
    }

    if (data.fixSpelling) {
        getMainWindow()?.webContents.replaceMisspelling(data.fixSpelling)
        return
    }
}
