// due to this being open source, there is no easy way to hide the API keys (that I know of),
// so this is a basic encryption to hide it from scrapers
// you could easily find the keys, but please don't do that, thanks! :)
// you are not allowed to used these keys outside of the FreeShow software!
// (they are all free, so you can just get your own keys if you want)

export function getKey(type: string) {
  if (type === "pco_id") return decrypt("44020e5f54544351595749065b57050144515d5341070e50555d410b0c0544530d5e07524a5e565442530e00555443510d5548075a020456430c0d5140530902")
  if (type === "pco_secret") return decrypt("00000039511502360b5116520e0453574a5f0b53475a5804515c13590e5114570a575154430a5f5044010b51525c420c5a5148050a570907110d095813525c5553534208580743510954520641505c53")
  if (type === "chums_id") return "1d06020e020e1c3a192b"
  if (type === "chums_secret") return "0b070942180f3c3d120009"
  return "5a4104165513101501415e5b030a5d19121f03485f4603035a03"
}

const k = "pcof0erioa"
const decrypt = (v: string) => Array.from({ length: v.length / 2 }, (_, i) => String.fromCharCode(parseInt(v.substring(i * 2, i * 2 + 2), 16) ^ k.charCodeAt(i % k.length))).join("")
