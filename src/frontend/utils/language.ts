import { get } from "svelte/store"
import { MAIN, REMOTE } from "../../types/Channels"
import { dictionary, language } from "../stores"
import { replace } from "./languageData"
import { send } from "./request"

// https://medium.com/i18n-and-l10n-resources-for-developers/a-step-by-step-guide-to-svelte-localization-with-svelte-i18n-v3-2c3ff0d645b8
// https://github.com/kaisermann/svelte-i18n/blob/70725828bd3aa2ba77fe37dccb2890c57b27f6e4/src/cli/includes/deepSet.ts#L5
// https://github.com/kaisermann/svelte-i18n/blob/main/docs/Getting%20Started.md
// https://lokalise.com/blog/svelte-i18n/

const defaultPath = "./lang/en.json"

// WIP right to left
// const dir = derived(language, ($locale) => ($locale === "ar" ? "rtl" : "ltr"))

function setLanguage(locale: string = "") {
    if (!locale) {
        // locale = getLocaleFromHostname(/^(.*?)\./) || getLocaleFromPathname(/^\/(.*?)\//) || getLocaleFromNavigator() || getLocaleFromHash('lang') || 'en';
        // locale = window.navigator.userLanguage || window.navigator.language || 'en';
        locale = window.navigator.language
        Object.keys(replace).forEach((key) => {
            if (replace[key].includes(locale)) locale = key
        })
    }

    if (!replace[locale]) locale = "en"

    const url = defaultPath.replace("en", locale)
    fetch(url)
        .then((response) => response.json())
        .then(returnedFile)

    async function returnedFile(messages) {
        // replace any missing keys in dictionary with fallback english string
        if (locale !== "en") {
            let defaultStrings = await (await fetch(defaultPath)).json()

            Object.keys(defaultStrings).forEach((key) => {
                if (!messages[key]) messages[key] = defaultStrings[key]
                else {
                    Object.keys(defaultStrings[key]).forEach((stringId) => {
                        if (!messages[key][stringId]) messages[key][stringId] = defaultStrings[key][stringId]
                    })
                }
            })
        }

        dictionary.set(messages)
        language.set(locale)

        let msg = { lang: locale, strings: messages }
        send(MAIN, ["LANGUAGE"], msg)
        send(REMOTE, ["LANGUAGE"], msg)
    }
}

const translate = (id: string, { parts = false } = {}) => {
    if (typeof id !== "string") return ""

    let d = get(dictionary)

    if (!parts) {
        let key = id.split(".")
        return d[key[0]]?.[key[1]]
    }

    if (!id.includes("$:")) return id

    // TODO: use regex for this
    let pre = id.slice(0, id.indexOf("$:"))
    let suf = id.slice(id.indexOf(":$") + 2, id.length)
    id = id.slice(id.indexOf("$:") + 2, id.indexOf(":$"))

    let category: string = id.slice(0, id.indexOf("."))
    let key = id.slice(id.indexOf(".") + 1, id.length)

    id = d[category]?.[key] || `[${id}]`

    return `${pre}${id}${suf}`
}

export { setLanguage, translate }
