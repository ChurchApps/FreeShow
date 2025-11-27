import { get } from "svelte/store"
import { OUTPUT } from "../../types/Channels"
import type { DropdownOptions } from "../../types/Input"
import { Main } from "../../types/IPC/Main"
import type { Dictionary } from "../../types/Settings"
import { sortByName } from "../components/helpers/array"
import { sendMain } from "../IPC/main"
import { dictionary, language, localeDirection } from "../stores"
import { isMainWindow } from "./common"
import { languageFlags, languages, replace } from "./languageData"
import { send } from "./request"

// https://medium.com/i18n-and-l10n-resources-for-developers/a-step-by-step-guide-to-svelte-localization-with-svelte-i18n-v3-2c3ff0d645b8
// https://github.com/kaisermann/svelte-i18n/blob/70725828bd3aa2ba77fe37dccb2890c57b27f6e4/src/cli/includes/deepSet.ts#L5
// https://github.com/kaisermann/svelte-i18n/blob/main/docs/Getting%20Started.md
// https://lokalise.com/blog/svelte-i18n/

const defaultPath = "./lang/en.json"

// WIP right to left
// const dir = derived(language, ($locale) => ($locale === "ar" ? "rtl" : "ltr"))

function setLanguage(locale = "", init = false) {
    if (!locale) {
        // locale = getLocaleFromHostname(/^(.*?)\./) || getLocaleFromPathname(/^\/(.*?)\//) || getLocaleFromNavigator() || getLocaleFromHash('lang') || 'en';
        // locale = window.navigator.userLanguage || window.navigator.language || 'en';
        locale = window.navigator.language
        Object.keys(replace).forEach(key => {
            if (replace[key].includes(locale)) locale = key
        })
    }

    if (!replace[locale]) locale = "en"
    language.set(locale)

    const rtlLanguages = ["ar", "fa", "he", "ur"]
    localeDirection.set(rtlLanguages.includes(locale) ? "rtl" : "ltr")

    const url = defaultPath.replace("en", locale)
    fetch(url)
        .then(response => response.json())
        .then(returnedFile)

    async function returnedFile(messages: Dictionary) {
        // replace any missing keys in dictionary with fallback english string
        if (locale !== "en") {
            const defaultStrings = await (await fetch(defaultPath)).json()

            Object.keys(defaultStrings).forEach(key => {
                if (!messages[key]) messages[key] = defaultStrings[key]
                else {
                    Object.keys(defaultStrings[key]).forEach(stringId => {
                        if (!(messages[key]![stringId] || "").trim()) messages[key]![stringId] = defaultStrings[key][stringId]
                    })
                }
            })
        }

        // a new language might have loaded
        if (init && get(language) !== "en" && get(language) !== locale) return

        dictionary.set(messages)
        if (init || !isMainWindow()) return

        language.set(locale)

        const msg = { lang: locale, strings: messages }
        sendMain(Main.LANGUAGE, msg)
        // remoteTalk.ts sends this
        // send(REMOTE, ["LANGUAGE"], msg)
        // wait until loaded
        setTimeout(() => {
            send(OUTPUT, ["LANGUAGE"], locale)
        }, 3000)
    }
}

// new translate function
// can take a "main.yes" into "Yes", or "main.yes [y]" into "Yes [y]"
export function translateText(text: string, _updater: any = null) {
    if (typeof text !== "string" || !text) return ""

    const dict = get(dictionary)

    return text.replace(/\$?([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)/g, (match, key1, key2) => {
        if (dict[key1] && dict[key1][key2]) {
            return dict[key1][key2]
        }

        return match
    })
}

export { setLanguage }

// Chinese, Japanese, and Korean should use full width brackets: "（" / "）"
const fullWidth = ["zh", "ja", "ko"]
export const getLeftParenthesis = () => (fullWidth.find(id => get(language).includes(id)) ? "（" : "(")
export const getRightParenthesis = () => (fullWidth.find(id => get(language).includes(id)) ? "）" : ")")

// dropdown selector
export function getLanguageList() {
    let options: DropdownOptions = Object.keys(languages).map(id => ({ label: languages[id], value: id }))
    options = sortByName(options, "label")

    // add flags after sorting
    options = options.map(a => ({ ...a, prefix: languageFlags[a.value] || "" }))

    return options
}
