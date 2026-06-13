import { describe, it, expect } from "vitest"
import { formatBytes } from "./bytes"

describe("formatBytes", () => {
    it("returns '0 Bytes' for zero", () => {
        expect(formatBytes(0)).toBe("0 Bytes")
    })

    it("formats each unit at the 1024 boundary", () => {
        expect(formatBytes(512)).toBe("512 Bytes")
        expect(formatBytes(1024)).toBe("1 KB")
        expect(formatBytes(1048576)).toBe("1 MB")
        expect(formatBytes(1073741824)).toBe("1 GB")
        expect(formatBytes(1099511627776)).toBe("1 TB")
    })

    it("rounds to whole numbers by default", () => {
        expect(formatBytes(2048)).toBe("2 KB")
        expect(formatBytes(1126)).toBe("1 KB")
    })

    it("honours the decimals argument", () => {
        expect(formatBytes(1536, 1)).toBe("1.5 KB")
        expect(formatBytes(1500, 2)).toBe("1.46 KB")
    })

    it("treats negative decimals as zero", () => {
        expect(formatBytes(2048, -5)).toBe("2 KB")
    })
})
