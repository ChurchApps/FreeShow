import { describe, it, expect } from "vitest"
import { formatBytes } from "./bytes"

describe("formatBytes", () => {
    it("returns '0 Bytes' for zero", () => {
        expect(formatBytes(0)).toBe("0 Bytes")
    })
    it("formats small values as Bytes", () => {
        expect(formatBytes(500)).toBe("500 Bytes")
    })
    it("formats values in KB / MB / GB using powers of 1024", () => {
        expect(formatBytes(1024)).toBe("1 KB")
        expect(formatBytes(1024 * 1024)).toBe("1 MB")
        expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB")
    })
    it("respects the decimals argument", () => {
        // 1536 bytes = 1.5 KB
        expect(formatBytes(1536, 1)).toBe("1.5 KB")
        expect(formatBytes(1536, 0)).toBe("2 KB") // rounded from 1.5
    })
    it("treats a negative decimals argument as 0 (defensive)", () => {
        expect(formatBytes(1536, -3)).toBe("2 KB")
    })
})
