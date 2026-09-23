import { describe, expect, it } from "vitest"
import { normalizeNumbers } from "./numbers"

describe("normalizeNumbers - Multilingual", () => {
    it("normalizes English numbers", () => {
        expect(normalizeNumbers("John three sixteen")).toBe("john 3 16")
        expect(normalizeNumbers("twenty five")).toBe("25")
        expect(normalizeNumbers("one hundred and nineteen")).toBe("119")
        expect(normalizeNumbers("verse 1 through 6")).toBe("verse 1-6")
    })

    it("normalizes French numbers", () => {
        expect(normalizeNumbers("Jean trois seize")).toBe("jean 3 16")
        expect(normalizeNumbers("Jean chapitre trois verset seize")).toBe("jean chapitre 3 verset 16")
        expect(normalizeNumbers("vingt-trois")).toBe("23")
        expect(normalizeNumbers("vingt et un")).toBe("21")
        expect(normalizeNumbers("soixante-seize")).toBe("76")
        expect(normalizeNumbers("quatre-vingt-dix-neuf")).toBe("99")
        expect(normalizeNumbers("deux cent seize")).toBe("216")
        expect(normalizeNumbers("verset 1 à 6")).toBe("verset 1-6")
        expect(normalizeNumbers("premier")).toBe("1")
    })

    it("normalizes Spanish numbers", () => {
        expect(normalizeNumbers("Juan tres dieciséis")).toBe("juan 3 16")
        expect(normalizeNumbers("Juan capítulo tres versículo dieciséis")).toBe("juan capítulo 3 versículo 16")
        expect(normalizeNumbers("treinta y cinco")).toBe("35")
        expect(normalizeNumbers("veinticinco")).toBe("25")
        expect(normalizeNumbers("ciento dieciséis")).toBe("116")
        expect(normalizeNumbers("versículo 1 hasta 6")).toBe("versículo 1-6")
    })

    it("normalizes German numbers", () => {
        expect(normalizeNumbers("Johannes drei sechzehn")).toBe("johannes 3 16")
        expect(normalizeNumbers("Johannes Kapitel drei Vers sechzehn")).toBe("johannes kapitel 3 vers 16")
        expect(normalizeNumbers("einundzwanzig")).toBe("21")
        expect(normalizeNumbers("dreiunddreißig")).toBe("33")
        expect(normalizeNumbers("zweihundert sechzehn")).toBe("216")
        expect(normalizeNumbers("Vers 1 bis 6")).toBe("vers 1-6")
    })

    it("normalizes Portuguese numbers", () => {
        expect(normalizeNumbers("João três dezesseis")).toBe("joão 3 16")
        expect(normalizeNumbers("trinta e cinco")).toBe("35")
        expect(normalizeNumbers("cem")).toBe("100")
    })

    it("normalizes Italian numbers", () => {
        expect(normalizeNumbers("Giovanni tre sedici")).toBe("giovanni 3 16")
        expect(normalizeNumbers("trenta e sei")).toBe("36")
        expect(normalizeNumbers("ventuno")).toBe("21")
    })

    it("normalizes Dutch numbers", () => {
        expect(normalizeNumbers("Johannes drie zestien")).toBe("johannes 3 16")
        expect(normalizeNumbers("eenentwintig")).toBe("21")
        expect(normalizeNumbers("vijfentwintig")).toBe("25")
    })

    it("normalizes Norwegian numbers", () => {
        expect(normalizeNumbers("Johannes tre seksten")).toBe("johannes 3 16")
        expect(normalizeNumbers("Johannes kapittel tre vers seksten")).toBe("johannes kapittel 3 vers 16")
        expect(normalizeNumbers("tjuefem")).toBe("25")
        expect(normalizeNumbers("femogtjue")).toBe("25")
        expect(normalizeNumbers("to hundre og seksten")).toBe("216")
        expect(normalizeNumbers("vers 1 til 6")).toBe("vers 1-6")
        expect(normalizeNumbers("første")).toBe("1")
    })
})
