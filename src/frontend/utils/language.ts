import { get } from "svelte/store"
import type { LanguageKey } from "../../types/Settings"
import { derived } from "svelte/store"
import { dictionary, language } from "../stores"
// import { dictionary, locale, _} from 'svelte-i18n';
// const LANGUAGE_FILE_URL = './lang/{locale}.json';
// let cachedLocale;

// let rtls = ["ar"]
const dir = derived(language, ($locale) => ($locale === "ar" ? "rtl" : "ltr"))

function setLanguage(locale: null | LanguageKey = null) {
  if (!locale) {
    let replace: any = {
      no: ["nb", "nn"],
      en: ["en-US"],
    }
    // locale = getLocaleFromHostname(/^(.*?)\./) || getLocaleFromPathname(/^\/(.*?)\//) || getLocaleFromNavigator() || getLocaleFromHash('lang') || 'en';
    // locale = window.navigator.userLanguage || window.navigator.language || 'en';
    locale = window.navigator.language || "en"
    Object.keys(replace).forEach((key) => {
      if (replace[key].includes(locale)) locale = key
      //   replace[key].forEach((l) => {
      //     if (locale === l) locale = key
      //   })
    })
  }
  // console.log(locale);

  // const messsagesFileUrl = LANGUAGE_FILE_URL.replace('{locale}', locale);
  const url = "./lang/" + locale + ".json"

  return fetch(url)
    .then((response) => response.json())
    .then((messages) => {
      dictionary.set(messages)
      // cachedLocale = locale;
      language.set(locale!)
      // console.log(messages);
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
    // let category = id.slice(0, id.indexOf('.'));
    // let key = id.slice(id.indexOf('.') + 1, id.length);
    // string = d[category]?.[key];
    if (!string) string = `[${id}]`
  }

  // replace data {name} = 'Name'

  // console.log(lang);
  // console.log(d);
  // console.log(string);
  return string
}

export { setLanguage, dir, translate }
