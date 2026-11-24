import { afterEach, describe, expect, it, vi } from "vitest"

// translation.ts pulls in stores + history; translate() itself only needs fetch.
vi.mock("../../../../stores", () => ({ showsCache: {}, templates: {} }))
vi.mock("../../../../utils/common", () => ({ newToast: vi.fn() }))
vi.mock("../../../../utils/createData", () => ({ createDoubleTemplate: vi.fn() }))
vi.mock("../../../edit/scripts/textStyle", () => ({ getItemTextArray: vi.fn() }))
vi.mock("../../../helpers/array", () => ({ clone: vi.fn(), sortByName: vi.fn() }))
vi.mock("../../../helpers/history", () => ({ history: vi.fn() }))

import { translate } from "./translation"

afterEach(() => vi.unstubAllGlobals())

// the text is echoed back, so this is the "q" value the API would receive
async function getSentText(text: string) {
    const fetchMock = vi.fn((url: string) => Promise.resolve({ json: () => [[[new URL(url).searchParams.get("q")]]] }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await translate(text, "de")

    const params = new URL(fetchMock.mock.calls[0][0]).searchParams
    expect([...params.keys()]).toEqual(["client", "sl", "tl", "dt", "q"])
    return result
}

describe("translate", () => {
    it.each(["Grace & peace", "#1 Hit", "Father + Son", "100% yours", "Where are you?", "Amazing grace[-] How sweet the sound", "Größe äöü 你好"])("sends the whole text: %s", async (text) => {
        expect(await getSentText(text)).toBe(text)
    })
})
