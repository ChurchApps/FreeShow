// due to this being open source, there is no easy way to hide the API keys (that I know of),
// so this is a basic encryption to hide it from scrapers
// you could easily find the keys, but please don't do that, thanks! :)
// you are not allowed to used these keys outside of the FreeShow software!
// (they are all free, so you can just get your own keys if you want)

export function getKey(type: string) {
    if (type === "bibleapi") return decrypt("030647000115404f5d5e51034e52571211475d0d510d4f5a024611135b09510d")
    if (type === "bibleapi_fallback") return decrypt("01021650564147460a5e08514704524e14445b0e040d1355024440465d5a5503")
    if (type === "pixabay") return decrypt("010545570c404c4743080703455a01464c4f5908510347030d161046580e04064656")
    if (type === "unsplash") return decrypt("465f183263251c24097e5c0d41506e301d425b4d46675a325e3a3e442a79067b44524646313c0c547a6e43")
    return "5a4104165513101501415e5b030a5d19121f03485f4603035a03"
}

const k = "04wb4wuvn8"
const decrypt = (v: any) => Array.from({ length: v.length / 2 }, (_, i) => String.fromCharCode(parseInt(v.substring(i * 2, i * 2 + 2), 16) ^ k.charCodeAt(i % k.length))).join("")
// const encrypt = (text) => Array.from(text, (char, i) => ('0' + (char.charCodeAt(0) ^ k.charCodeAt(i % k.length)).toString(16)).slice(-2)).join('');
