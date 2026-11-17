import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { build } from "esbuild"
import { compile, preprocess } from "svelte/compiler"
import sveltePreprocess from "svelte-preprocess"
import { expect, test } from "@playwright/test"

const root = resolve(__dirname, "../..")
const editor = resolve(root, "src/frontend/components/edit/editbox/EditboxLines.svelte")
let bundle = ""
const pageErrors = new WeakMap<object, string[]>()
test.beforeEach(async ({ page }) => {
    const errors: string[] = []
    pageErrors.set(page, errors)
    page.on("pageerror", (error) => errors.push(error.message))
})
test.afterEach(async ({ page }) => {
    await page.waitForTimeout(100)
    expect(pageErrors.get(page)).toEqual([])
})
test.beforeAll(async () => {
    const mocks: Record<string, string> = {
        "../../../show/slides": "export const copySlideLayoutProperties=()=>{},splitCustomDynamicValues=()=>({})",
        "../../../stores": `import {writable} from 'svelte/store'; export const activeEdit=writable({slide:0,items:[0]}), activeShow=writable({}), activeStage=writable({}), isOptimizedMode=writable(false), overlays=writable({}), redoHistory=writable([]), refreshListBoxes=writable(false), showsCache=writable({}), stageShows=writable({}), templates=writable({});`,
        "../../../utils/common": "export const newToast=()=>{}",
        "../../../utils/shortcuts": "export const getNormalizedKey=e=>e.key,isComposing=e=>e.isComposing,isFormattingKey=()=>false",
        "../../helpers/T.svelte": "export default class {}",
        "../../helpers/array": "export const clone=v=>structuredClone(v)",
        "../../helpers/history": "export const history=()=>{}",
        "../../helpers/mover": "export const addToPos=()=>{}",
        "../../helpers/show": "export const getLayoutRef=()=>({})",
        "../../helpers/shows": "export const _show=()=>({slides:()=>({get:()=>[],set:()=>{}})})",
        "../../helpers/style": `export const getStyles=(s='')=>Object.fromEntries(s.split(';').filter(x=>x.includes(':')).map(x=>{let i=x.indexOf(':');return [x.slice(0,i).trim(),x.slice(i+1).trim()]}))`,
        "../scripts/shapeOutside": "export const calculateShapeVerticalOffset=()=>0,getShapeFloatSide=()=>''",
        "../scripts/textStyle": `export const getItemText=item=>(item?.lines||[]).flatMap(l=>l.text||[]).map(x=>x.value||'').join('\\n'),getLineText=l=>(l?.text||[]).map(x=>x.value||'').join(''),getSelectionRange=()=>[],setCaret=()=>{}`,
        "./EditboxChords.svelte": "export default class {}",
        "./EditboxPaste": "export const EditboxPaste={}"
    }
    const result = await build({
        stdin: { contents: `import Component from ${JSON.stringify(editor)};import autosize from './src/frontend/components/edit/scripts/autosize';window.autosize=autosize;let c;window.mount=(item)=>{c?.$destroy();c=new Component({target:document.querySelector('#target'),props:{item,ref:{id:'test',type:'show'},index:0}});window.item=item};window.update=props=>c.$set(props);`, resolveDir: root, sourcefile: "editor-fixture.js" },
        bundle: true,
        write: false,
        format: "iife",
        platform: "browser",
        conditions: ["browser"],
        plugins: [
            {
                name: "editor",
                setup(b) {
                    b.onResolve({ filter: /.*/ }, (args) => ((args.importer === editor || args.importer.endsWith("/EditboxHelper.ts")) && mocks[args.path] ? { path: args.path, namespace: "mock" } : undefined))
                    b.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({ contents: mocks[args.path], resolveDir: root }))
                    b.onLoad({ filter: /\.svelte$/ }, async (args) => {
                        const s = await preprocess(readFileSync(args.path, "utf8"), sveltePreprocess({ typescript: { tsconfigFile: false } }), { filename: args.path })
                        const o = compile(s.code, { filename: args.path, css: true, dev: false })
                        return { contents: o.js.code, resolveDir: resolve(args.path, "..") }
                    })
                }
            }
        ]
    })
    bundle = result.outputFiles[0].text
})
test("enabled editor separates visual wrapped backgrounds without modifying editable text", async ({ page }) => {
    await page.setContent('<style>body{margin:0}#target{width:400px;height:400px}</style><div id="target"></div>')
    await page.addScriptTag({ content: bundle })
    const value = "selamat datang di kota Bitung Kota Cakalang Indah Bitung"
    await page.evaluate((value) => (window as any).mount({ type: "text", style: "", align: "", specialStyle: { lineBg: "#000", lineGap: 20, separateWrappedLines: true }, lines: [{ align: "text-align:center;", text: [{ value, style: "font-family:Arial;font-size:36px;line-height:1.2;" }] }] }), value)
    await expect(page.locator(".edit .break")).toHaveCount(1)
    await expect(page.locator(".edit")).toHaveText(value)
    await expect.poll(() => page.locator("[data-edit-wrap-row]").count()).toBeGreaterThanOrEqual(2)
    await expect(page.locator(".edit [data-edit-wrap-row]")).toHaveCount(0)
})

function editorItem(enabled: boolean, gap: number, values: string[]) {
    return { type: "text", style: "", align: "", specialStyle: { lineBg: "#000", lineGap: gap, separateWrappedLines: enabled }, lines: values.map((value) => ({ align: "text-align:center;", text: [{ value, style: "font-family:Arial;font-size:36px;line-height:1.2;" }] })) }
}
async function setup(page: any) {
    await page.setContent('<style>body{margin:0}#target{width:320px;height:400px}</style><div id="target"></div>')
    await page.addScriptTag({ content: bundle })
}
async function rects(page: any, selector: string) {
    return page.locator(selector).evaluateAll((nodes: Element[]) =>
        nodes.map((n) => {
            const r = n.getBoundingClientRect()
            return { top: r.top, bottom: r.bottom, width: r.width, height: r.height }
        })
    )
}
for (const gap of [20, 0])
    test(`wrapped rows match explicit Enter backgrounds at gap ${gap}`, async ({ page }) => {
        await setup(page)
        const first = "alpha beta gamma",
            second = "delta epsilon zeta"
        await page.evaluate((x) => (window as any).mount(x), editorItem(false, gap, [first, second]))
        await expect(page.locator(".edit .break")).toHaveCount(2)
        const enter = await rects(page, ".edit .break")
        await page.evaluate((x) => (window as any).mount(x), editorItem(true, gap, [`${first} ${second}`]))
        await expect(page.locator("[data-edit-wrap-row]")).toHaveCount(2)
        const wrap = await rects(page, "[data-edit-wrap-row]")
        for (let i = 0; i < 2; i++) {
            expect(wrap[i].width).toBeCloseTo(enter[i].width, 0)
            expect(wrap[i].height).toBeCloseTo(enter[i].height, 0)
        }
        expect(wrap[1].top - wrap[0].bottom).toBeCloseTo(enter[1].top - enter[0].bottom, 0)
    })

test("autosize clone excludes editor-only decoration and scoped styles", async ({ page }) => {
    await setup(page)
    await page.evaluate((x) => (window as any).mount(x), editorItem(true, 20, ["alpha beta gamma delta epsilon zeta"]))
    await expect(page.locator("[data-edit-wrap-row]")).toHaveCount(2)
    const clone = await page.evaluate(() => {
        let result: any
        const original = Element.prototype.after
        Element.prototype.after = function (...nodes: any[]) {
            const copy = nodes[0] as Element
            result = { layers: copy.querySelectorAll("[data-edit-wrap-layer]").length, styles: copy.querySelectorAll("style").length, marked: copy.querySelectorAll("[data-edit-wrap]").length }
            return original.apply(this, nodes)
        }
        try {
            ;(window as any).autosize(document.querySelector(".align"), { type: "growToFit", textQuery: ".edit .break span", defaultFontSize: 36, maxFontSize: 40, minFontSize: 10, wrappedLineOptions: { enabled: true, gap: 20, background: "#000" } })
        } finally {
            Element.prototype.after = original
        }
        return result
    })
    expect(clone).toEqual({ layers: 0, styles: 0, marked: 0 })
})

test("toggle and resize preserve native editable HTML and source lines", async ({ page }) => {
    await setup(page)
    const item = editorItem(false, 20, ["alpha beta gamma delta epsilon zeta"])
    await page.evaluate((x) => (window as any).mount(x), item)
    const edit = page.locator(".edit")
    await expect(edit.locator(".break")).toHaveCount(1)
    const before = await edit.innerHTML()
    const initialHeight = await edit
        .locator("span")
        .first()
        .evaluate((e) => getComputedStyle(e).lineHeight)
    await page.evaluate(() => {
        const item = (window as any).item
        item.specialStyle.separateWrappedLines = true
        ;(window as any).update({ item })
    })
    await expect(page.locator("[data-edit-wrap-row]")).toHaveCount(2)
    expect(await edit.innerHTML()).toBe(before)
    await page.locator("#target").evaluate((e: HTMLElement) => (e.style.width = "200px"))
    await expect.poll(() => page.locator("[data-edit-wrap-row]").count()).toBeGreaterThan(2)
    expect(await edit.innerHTML()).toBe(before)
    expect(await page.evaluate(() => (window as any).item.lines.length)).toBe(1)
    await page.evaluate(() => {
        const item = (window as any).item
        item.specialStyle.separateWrappedLines = false
        ;(window as any).update({ item })
    })
    await expect(page.locator("[data-edit-wrap-row]")).toHaveCount(0)
    expect(await edit.innerHTML()).toBe(before)
    expect(
        await edit
            .locator("span")
            .first()
            .evaluate((e) => getComputedStyle(e).lineHeight)
    ).toBe(initialHeight)
})

test("native typing and undo preserve selection and one source line", async ({ page }) => {
    await setup(page)
    const value = "alpha beta gamma delta epsilon zeta"
    await page.evaluate((x) => (window as any).mount(x), editorItem(true, 20, [value]))
    await expect(page.locator("[data-edit-wrap-row]")).toHaveCount(2)
    const edit = page.locator(".edit")
    await edit.click()
    await page.keyboard.press("End")
    await page.keyboard.type("X")
    await expect(edit).toContainText("X")
    expect(await page.evaluate(() => document.activeElement?.classList.contains("edit"))).toBe(true)
    expect(await page.evaluate(() => (window as any).getSelection()?.isCollapsed)).toBe(true)
    await page.keyboard.press("ControlOrMeta+z")
    await expect(edit).toHaveText(value)
    await expect.poll(() => page.evaluate(() => (window as any).item.lines.length)).toBe(1)
})

test("mixed font spans reflow without inserting nodes in editable content", async ({ page }) => {
    await setup(page)
    const item = editorItem(true, 20, ["alpha beta gamma "])
    item.lines[0].text.push({ value: "delta epsilon zeta", style: "font-family:Arial;font-size:48px;line-height:1.2;font-weight:bold;" })
    await page.evaluate((x) => (window as any).mount(x), item)
    await expect.poll(() => page.locator("[data-edit-wrap-row]").count()).toBeGreaterThanOrEqual(2)
    const initialRows = await page.locator("[data-edit-wrap-row]").count()
    const edit = page.locator(".edit")
    const before = await edit.innerHTML()
    await expect(edit.locator(".break > span")).toHaveCount(2)
    await page.locator("#target").evaluate((e: HTMLElement) => (e.style.width = "200px"))
    await expect.poll(() => page.locator("[data-edit-wrap-row]").count()).toBeGreaterThan(initialRows)
    expect(await edit.innerHTML()).toBe(before)
    await expect(edit.locator("[data-edit-wrap-row]")).toHaveCount(0)
    expect(await page.evaluate(() => (window as any).item.lines.length)).toBe(1)
})

test("scaled editor with normal line height matches explicit Enter geometry", async ({ page }) => {
    await setup(page)
    await page.locator("#target").evaluate((e: HTMLElement) => {
        e.style.transformOrigin = "top left"
        e.style.transform = "scale(0.5)"
    })
    const first = "alpha beta gamma",
        second = "delta epsilon zeta"
    const entered = editorItem(false, 20, [first, second])
    entered.lines.forEach((line) => (line.text[0].style = "font-family:Arial;font-size:36px;line-height:normal;"))
    await page.evaluate((x) => (window as any).mount(x), entered)
    await expect(page.locator(".edit .break")).toHaveCount(2)
    const native = await rects(page, ".edit .break")
    const wrapped = editorItem(true, 20, [`${first} ${second}`])
    wrapped.lines[0].text[0].style = "font-family:Arial;font-size:36px;line-height:normal;"
    await page.evaluate((x) => (window as any).mount(x), wrapped)
    await expect(page.locator("[data-edit-wrap-row]")).toHaveCount(2)
    expect(native.every((row) => row.width > 0 && row.height > 0)).toBe(true)
    await expect
        .poll(
            async () => {
                const painted = await rects(page, "[data-edit-wrap-row]")
                if (painted.length !== 2 || painted.some((row) => !Number.isFinite(row.width) || !Number.isFinite(row.height) || row.width <= 0 || row.height <= 0)) return false
                return painted.every((row, i) => Math.abs(row.width - native[i].width) < 0.5 && Math.abs(row.height - native[i].height) < 0.5) && Math.abs(painted[1].top - painted[0].bottom - (native[1].top - native[0].bottom)) < 0.5
            },
            { timeout: 5000 }
        )
        .toBe(true)
})
