// ----- FreeShow -----
// Safe arithmetic expression evaluator.
// Replaces `new Function("return " + input)()`, which could execute arbitrary JS from
// user/network input. This only supports numbers (incl. decimals and e-notation),
// the operators + - * / % **, unary +/-, and parentheses. Any identifier, function call,
// property access, or other token throws — so callers can keep their existing try/catch fallbacks.

export function evaluateExpression(input: string | number): number {
    if (typeof input === "number") return input

    const tokens = tokenize(input)
    let pos = 0
    const peek = () => tokens[pos]
    const next = () => tokens[pos++]

    function parseExpression(): number {
        let value = parseTerm()
        while (peek() === "+" || peek() === "-") {
            const op = next()
            const rhs = parseTerm()
            value = op === "+" ? value + rhs : value - rhs
        }
        return value
    }

    function parseTerm(): number {
        let value = parseFactor()
        while (peek() === "*" || peek() === "/" || peek() === "%") {
            const op = next()
            const rhs = parseFactor()
            if (op === "*") value *= rhs
            else if (op === "/") value /= rhs
            else value %= rhs
        }
        return value
    }

    function parseFactor(): number {
        const value = parseUnary()
        if (peek() === "**") {
            next()
            return value ** parseFactor() // right-associative
        }
        return value
    }

    function parseUnary(): number {
        if (peek() === "+") {
            next()
            return parseUnary()
        }
        if (peek() === "-") {
            next()
            return -parseUnary()
        }
        return parsePrimary()
    }

    function parsePrimary(): number {
        const token = peek()
        if (token === "(") {
            next()
            const value = parseExpression()
            if (next() !== ")") throw new Error("Expected )")
            return value
        }
        if (token === undefined || !/^[0-9.]/.test(token)) throw new Error("Unexpected token: " + token)
        next()
        const num = Number(token)
        if (Number.isNaN(num)) throw new Error("Invalid number: " + token)
        return num
    }

    const result = parseExpression()
    if (pos !== tokens.length) throw new Error("Unexpected trailing input")
    return result
}

function tokenize(input: string): string[] {
    const tokens: string[] = []
    let i = 0
    while (i < input.length) {
        const ch = input[i]
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
            i++
            continue
        }
        if (ch === "*" && input[i + 1] === "*") {
            tokens.push("**")
            i += 2
            continue
        }
        if ("+-*/%()".includes(ch)) {
            tokens.push(ch)
            i++
            continue
        }
        // number: 5, 5.5, .5, 5., 5e3, 1.5e-3
        const match = /^(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:e[+-]?[0-9]+)?/i.exec(input.slice(i))
        if (match && match[0]) {
            tokens.push(match[0])
            i += match[0].length
            continue
        }
        throw new Error("Invalid character: " + ch)
    }
    return tokens
}
