// Check rendered text, after dynamic values have been resolved. Empty editor markup
// still occupies a line for layout, but should not paint a lyric background.
export function hasVisibleLineText(value: string): boolean {
    const text = value
        .replace(/<[^>]*>/g, "")
        .replace(/&(?:nbsp|ensp|emsp|thinsp|zwnj|zwj|ZeroWidthSpace);/gi, " ")
        .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (entity, digits: string) => {
            const isHex = digits[0].toLowerCase() === "x"
            const codePoint = parseInt(isHex ? digits.slice(1) : digits, isHex ? 16 : 10)
            return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity
        })
        .replace(/[\u200b-\u200d\u2060\ufeff]/g, "")
    return text.trim().length > 0
}
