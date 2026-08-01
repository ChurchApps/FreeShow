import fs from "fs"
import os from "os"
import path from "path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { setDataRoot } from "./dataPaths"
import { createFolder, loadShow, readFolderContent } from "./persistence"

let tmp = ""

beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fs-readfolder-"))
    setDataRoot(tmp) // sandbox root
    fs.mkdirSync(path.join(tmp, "Media"))
    fs.mkdirSync(path.join(tmp, "Media", "Songs"))
    fs.writeFileSync(path.join(tmp, "Media", "a.png"), "x")
})

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))

describe("headless readFolderContent (sandboxed server browsing)", () => {
    it("browses the root with SANDBOX-RELATIVE paths (no absolute base exposed)", () => {
        const map = readFolderContent({ path: "", depth: 0 })
        // root is keyed as "" (relative), and children are relative
        expect(map[""]?.isFolder).toBe(true)
        expect(map["Media"]?.isFolder).toBe(true)
        // no absolute paths leak into the keys
        expect(Object.keys(map).every((k) => !path.isAbsolute(k))).toBe(true)
    })

    it("lists nested folders/files with relative paths", () => {
        const map = readFolderContent({ path: "Media", depth: 0 })
        expect(map["Media/Songs"]?.isFolder).toBe(true)
        expect(map[path.join("Media", "a.png")]).toMatchObject({ isFolder: false, name: "a.png" })
    })

    it("ignores paths that escape the sandbox", () => {
        expect(readFolderContent({ path: "../../.." })).toEqual({})
        expect(readFolderContent({ path: "/etc" })).toEqual({})
    })
})

describe("headless createFolder (sandboxed)", () => {
    it("creates a subfolder and returns its relative path", () => {
        const rel = createFolder({ path: "Media", name: "New Set" })
        expect(rel).toBe(path.join("Media", "New Set"))
        expect(fs.existsSync(path.join(tmp, "Media", "New Set"))).toBe(true)
    })

    it("refuses to create outside the sandbox", () => {
        expect(createFolder({ path: "..", name: "escaped" })).toBe("")
        expect(createFolder({ path: "Media", name: "../../escaped" })).toBe("")
        expect(fs.existsSync(path.join(tmp, "..", "escaped"))).toBe(false)
    })
})

describe("headless loadShow", () => {
    it("finds a show by id when the client doesn't know the file name yet", () => {
        // a client that just received the index broadcast requests the show before its
        // local index updates, so `name` is undefined -> must still resolve by id
        fs.mkdirSync(path.join(tmp, "Shows"), { recursive: true })
        fs.writeFileSync(path.join(tmp, "Shows", "My New Song.show"), JSON.stringify(["show123", { name: "My New Song", slides: {} }]))

        const byName = loadShow({ id: "show123", name: "My New Song" })
        expect(byName.error).toBeUndefined()

        const byIdOnly = loadShow({ id: "show123", name: "" })
        expect(byIdOnly.error).toBeUndefined()
        expect(byIdOnly.content?.[1]?.name).toBe("My New Song")
    })

    it("still reports not_found for a genuinely missing show", () => {
        expect(loadShow({ id: "nope", name: "" }).error).toBe("not_found")
    })
})
