// due to this being open source, there is no easy way to hide the API keys (that I know of),
// so this is a basic encryption to hide it from scrapers
// you could easily find the keys, but please don't do that, thanks! :)
// you are not allowed to used these keys outside of the FreeShow software!
// (they are all free, so you can just get your own keys if you want)

export function getKey(type: string) {
    if (type === "pco_id") return "35d1112d839d678ce3f1de730d2cff0b81038c2944b11c5e2edf03f8b43abc05"
    if (type === "churchApps_id") return decrypt("1e2608317f261819055200")
    if (type === "churchApps_secret") return decrypt("02022a207f57193d5f2d13")
    if (type === "amazinglife_id") return decrypt("0825252041520b273614283b372b48552b2b0630")
    if (type === "canva_id") return decrypt("3f2042276a0a3c39350345103a1e52")
    if (type === "canva_secret") return decrypt("130d1905513f37181b023e33163f73203a3b5a11172d42547715240816024207052c7b313d0f3c0b061a3d53582f45300b03465a5f535203")
    if (type === "enc_general") return decrypt("11010c5702562601061239102e21550b171b0e0d3b061647")
    if (type === "enc_salt") return decrypt("1600180f43171e07")
    return "5a4104165513101501415e5b030a5d19121f03485f4603035a03"
}

const k = "pcof0erioa"
const decrypt = (v: string) => Array.from({ length: v.length / 2 }, (_, i) => String.fromCharCode(parseInt(v.substring(i * 2, i * 2 + 2), 16) ^ k.charCodeAt(i % k.length))).join("")
