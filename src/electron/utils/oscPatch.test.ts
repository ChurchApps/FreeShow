import { describe, expect, it } from "vitest"
import OSC from "osc-js"
import "./oscPatch"

describe("oscPatch", () => {
    it("correctly encodes and decodes non-ASCII strings (Chinese song titles)", () => {
        const title = "赞美诗歌 123"
        const message = new OSC.Message("/freeshow/song", title)
        const packed = message.pack()

        expect(packed).toBeInstanceOf(Uint8Array)
        expect(packed.byteLength % 4).toBe(0)

        const unpacked = new OSC.Message("")
        unpacked.unpack(new DataView(packed.buffer, packed.byteOffset, packed.byteLength))

        expect(unpacked.address).toBe("/freeshow/song")
        expect(unpacked.args).toEqual([title])
    })

    it("correctly handles characters where low byte is 0x00 (such as U+4E00 一)", () => {
        const payload = "獨一真神|verse1|1"
        const message = new OSC.Message("/test", payload)
        const packed = message.pack()

        const unpacked = new OSC.Message("")
        unpacked.unpack(new DataView(packed.buffer, packed.byteOffset, packed.byteLength))

        expect(unpacked.address).toBe("/test")
        expect(unpacked.args).toEqual([payload])
    })

    it("correctly encodes and decodes non-ASCII addresses and mixed types", () => {
        const address = "/freeshow/歌名/播放"
        const stringArg = "这是一首测试歌曲 🎵 (Test Song)"
        const intArg = 1234
        const floatArg = 45.67

        const message = new OSC.Message(address, stringArg, intArg, floatArg)
        const packed = message.pack()

        expect(packed.byteLength % 4).toBe(0)

        const unpacked = new OSC.Message("")
        unpacked.unpack(new DataView(packed.buffer, packed.byteOffset, packed.byteLength))

        expect(unpacked.address).toBe(address)
        expect(unpacked.args[0]).toBe(stringArg)
        expect(unpacked.args[1]).toBe(intArg)
        expect(Math.abs((unpacked.args[2] as number) - floatArg)).toBeLessThan(0.01)
    })

    it("correctly encodes empty strings and ASCII strings", () => {
        const message = new OSC.Message("/test", "", "Hello World")
        const packed = message.pack()

        expect(packed.byteLength % 4).toBe(0)

        const unpacked = new OSC.Message("")
        unpacked.unpack(new DataView(packed.buffer, packed.byteOffset, packed.byteLength))

        expect(unpacked.address).toBe("/test")
        expect(unpacked.args).toEqual(["", "Hello World"])
    })

    it("works with OSC bundles containing non-ASCII messages", () => {
        const bundle = new OSC.Bundle([new OSC.Message("/freeshow/slide/1", "第一节 歌词"), new OSC.Message("/freeshow/slide/2", "第二节 歌词")])
        const packed = bundle.pack()

        expect(packed.byteLength % 4).toBe(0)

        const unpacked = new OSC.Bundle()
        unpacked.unpack(new DataView(packed.buffer, packed.byteOffset, packed.byteLength))

        expect(unpacked.bundleElements).toHaveLength(2)
        const msg1 = unpacked.bundleElements[0] as OSC.Message
        const msg2 = unpacked.bundleElements[1] as OSC.Message
        expect(msg1.args).toEqual(["第一节 歌词"])
        expect(msg2.args).toEqual(["第二节 歌词"])
    })
})
