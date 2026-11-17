import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { resolve } from "node:path"
import ts from "typescript"
import { getStyles } from "../../src/frontend/components/helpers/style"

// Exercise the real merge and its local helpers without starting app services.
const source = ts.createSourceFile("output.ts", readFileSync(resolve(__dirname, "../../src/frontend/components/helpers/output.ts"), "utf8"), ts.ScriptTarget.Latest)
const declarations = source.statements
    .filter(ts.isFunctionDeclaration)
    .map((node) => node.getFullText(source))
    .join("\n")
const context: any = {
    exports: {},
    clone: structuredClone,
    getStyles,
    areObjectsEqual: (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b),
    getItemText: (item: any) =>
        (item.lines || [])
            .flatMap((line: any) => line.text || [])
            .map((text: any) => text.value || "")
            .join("\n")
}
runInNewContext(ts.transpileModule(declarations, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, context)
export const mergeForTest = context.exports.mergeWithTemplate
