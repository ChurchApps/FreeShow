import { derived, get } from "svelte/store"
import { MAIN, REMOTE } from "../../types/Channels"
import { dictionary, language } from "../stores"
import { replace } from "./languageData"

// https://lokalise.com/blog/svelte-i18n/

// let rtls = ["ar"]
const dir = derived(language, ($locale) => ($locale === "ar" ? "rtl" : "ltr"))

function setLanguage(locale: null | string = null) {
    if (!locale) {
        // locale = getLocaleFromHostname(/^(.*?)\./) || getLocaleFromPathname(/^\/(.*?)\//) || getLocaleFromNavigator() || getLocaleFromHash('lang') || 'en';
        // locale = window.navigator.userLanguage || window.navigator.language || 'en';
        locale = window.navigator.language
        Object.keys(replace).forEach((key) => {
            if (replace[key].includes(locale)) locale = key
        })
    }
    if (!replace[locale]) locale = "en"

    // const messsagesFileUrl = LANGUAGE_FILE_URL.replace('{locale}', locale);
    const url = "./lang/" + locale + ".json"

    return fetch(url)
        .then((response) => response.json())
        .then(async (messages) => {
            // replace any missing keys in dictionary with fallback english string
            if (locale !== "en") {
                let defaultStrings = await (await fetch("./lang/en.json")).json()

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
            window.api.send(MAIN, { channel: "LANGUAGE", data: { lang: locale, strings: messages } })
            window.api.send(REMOTE, { channel: "LANGUAGE", data: { lang: locale, strings: messages } })
            language.set(locale!)
        })
}

// let d: Dictionary = {}
// // let lang = 'en';
// dictionary.subscribe((dictionary) => (d = dictionary))
// // language.subscribe(language => lang = language);

// https://medium.com/i18n-and-l10n-resources-for-developers/a-step-by-step-guide-to-svelte-localization-with-svelte-i18n-v3-2c3ff0d645b8
// https://github.com/kaisermann/svelte-i18n/blob/70725828bd3aa2ba77fe37dccb2890c57b27f6e4/src/cli/includes/deepSet.ts#L5
// https://github.com/kaisermann/svelte-i18n/blob/main/docs/Getting%20Started.md
// https://lokalise.com/blog/svelte-i18n/

// WIP Not updating dictionary...
// svelte reactive functions...
const translate = (id: string, { data = {}, parts = false } = {}) => {
    console.log(data)
    let d = get(dictionary)

    let string
    if (parts) {
        let pre = "",
            suf = ""
        if (id.includes("$:")) {
            // TODO: use regex for this
            pre = id.slice(0, id.indexOf("$:"))
            suf = id.slice(id.indexOf(":$") + 2, id.length)
            id = id.slice(id.indexOf("$:") + 2, id.indexOf(":$"))
            let category: string = id.slice(0, id.indexOf("."))
            let key = id.slice(id.indexOf(".") + 1, id.length)
            id = d[category]?.[key] || `[${id}]`
            string = `${pre}${id}${suf}`
        } else string = id
    } else {
        let key = id.split(".")
        string = d[key[0]]?.[key[1]]
    }

    return string
}

export { setLanguage, dir, translate }
