import { describe, it, expect } from "vitest"
import { evaluateExpression } from "./expression"

describe("evaluateExpression", () => {
    describe("numbers", () => {
        it("returns a numeric input unchanged", () => {
            expect(evaluateExpression(42)).toBe(42)
            expect(evaluateExpression(-3.5)).toBe(-3.5)
        })

        it("parses integers and decimals", () => {
            expect(evaluateExpression("0")).toBe(0)
            expect(evaluateExpression("42")).toBe(42)
            expect(evaluateExpression("3.14")).toBe(3.14)
            expect(evaluateExpression(".5")).toBe(0.5)
            expect(evaluateExpression("5.")).toBe(5)
        })

        it("parses scientific notation", () => {
            expect(evaluateExpression("1e3")).toBe(1000)
            expect(evaluateExpression("1.5e-2")).toBe(0.015)
            expect(evaluateExpression("2E2")).toBe(200)
        })
    })

    describe("arithmetic", () => {
        it("adds and subtracts (left-associative)", () => {
            expect(evaluateExpression("2 + 3")).toBe(5)
            expect(evaluateExpression("10 - 4 - 3")).toBe(3)
        })

        it("multiplies, divides and takes the modulo", () => {
            expect(evaluateExpression("6 * 7")).toBe(42)
            expect(evaluateExpression("10 / 4")).toBe(2.5)
            expect(evaluateExpression("10 % 3")).toBe(1)
        })

        it("respects operator precedence", () => {
            expect(evaluateExpression("2 + 3 * 4")).toBe(14)
            expect(evaluateExpression("2 * 3 + 4")).toBe(10)
        })

        it("honours parentheses", () => {
            expect(evaluateExpression("(2 + 3) * 4")).toBe(20)
            expect(evaluateExpression("2 * (3 + (4 - 1))")).toBe(12)
        })

        it("handles unary plus and minus", () => {
            expect(evaluateExpression("-5")).toBe(-5)
            expect(evaluateExpression("+5")).toBe(5)
            expect(evaluateExpression("3 - -2")).toBe(5)
            expect(evaluateExpression("-(2 + 3)")).toBe(-5)
        })

        it("exponentiates right-associatively", () => {
            expect(evaluateExpression("2 ** 3")).toBe(8)
            expect(evaluateExpression("2 ** 3 ** 2")).toBe(512)
            expect(evaluateExpression("2 ** -2")).toBe(0.25)
        })

        it("ignores surrounding and internal whitespace", () => {
            expect(evaluateExpression("  7  +  8  ")).toBe(15)
            expect(evaluateExpression("\t2*2\n")).toBe(4)
        })
    })

    describe("rejects unsafe / non-arithmetic input (the reason this replaced new Function)", () => {
        const unsafe = ["alert(1)", "Math.max(1, 2)", "process.exit(1)", "globalThis", "1 + foo", "(1).constructor", "0x10", "1; alert(1)", "`${1}`", "[1, 2]"]
        it.each(unsafe)("throws on %j", (input) => {
            expect(() => evaluateExpression(input)).toThrow()
        })
    })

    describe("rejects malformed arithmetic", () => {
        const malformed = ["", "2 +", "(2 + 3", "2 3", "2 + 3 4", ")", "* 5"]
        it.each(malformed)("throws on %j", (input) => {
            expect(() => evaluateExpression(input)).toThrow()
        })
    })
})
