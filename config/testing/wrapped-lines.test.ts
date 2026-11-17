import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { build } from "esbuild"
import { compile, preprocess } from "svelte/compiler"
import sveltePreprocess from "svelte-preprocess"
import { expect, test } from "@playwright/test"
import { mergeForTest } from "./templateMergeFixture"

let bundle = ""
const pageErrors = new WeakMap<object, string[]>()
const root = resolve(__dirname, "../..")
const renderer = resolve(root, "src/frontend/components/slide/TextboxLines.svelte")

test.beforeAll(async () => {
    const mocks: Record<string, string> = {
        "../../show/slides": "export const createVirtualBreaks = lines => lines",
        "../../stores": "import {writable} from 'svelte/store'; export const outputs=writable({}),slidesOptions=writable({columns:4}),styles=writable({}),variables=writable({})",
        "../edit/scripts/textStyle": "export const getItemText = item => (item?.lines || []).flatMap(l=>l.text || []).map(t=>t.value || '').join('\\n')",
        "../helpers/array": "export const clone = structuredClone",
        "../helpers/output": "export const getFirstActiveOutput = () => null",
        "../helpers/showActions": "export const replaceDynamicValues = value => value.replaceAll('{title}', window.dynamicTitle || '')",
        "../helpers/style": "export const getStyles = (style='', numeric=false) => Object.fromEntries(style.split(';').filter(s=>s.includes(':')).map(s=>{const i=s.indexOf(':');const value=s.slice(i+1).trim();return [s.slice(0,i).trim(),numeric ? value.replace(/px$/, '') : value]}))",
        "../edit/scripts/shapeOutside": "export const calculateShapeVerticalOffset=()=>0,getShapeFloatSide=()=>''",
        "./wordOverride": "export const applyStyleOverrides = lines => lines"
    }
    const result = await build({
        stdin: {
            contents: `import Component from ${JSON.stringify(renderer)}; import autosize from './src/frontend/components/edit/scripts/autosize';
                let component;
                window.mount = (item, extra={}) => { component?.$destroy(); document.querySelector('#target').innerHTML=''; component=new Component({target:document.querySelector('#target'),props:{item,ref:{id:'test'},outputStyle:{},...extra}}); window.savedItem=item; };
                window.update = props => component.$set(props);
                window.measureAutoSize = options => autosize(document.querySelector('#target'), {textQuery:'.textContainer',...options});
                window.measureEditorSize = (options, wrappedLineOptions) => {
                    const editor=document.querySelector('#target').cloneNode(true);
                    editor.querySelectorAll('[data-wrap-rows]').forEach(node=>node.remove());
                    editor.querySelectorAll('[data-wrap-options]').forEach(node=>{delete node.dataset.wrapOptions;delete node.dataset.wrapEnabled});
                    editor.querySelectorAll('.textContainer').forEach(node=>{node.classList.remove('textContainer');node.dataset.freeshowText='true'});
                    document.body.append(editor);
                    try {return autosize(editor,{textQuery:'[data-freeshow-text]',...options,wrappedLineOptions})} finally {editor.remove()}
                };`,
            resolveDir: root,
            sourcefile: "wrapped-lines-fixture.js"
        },
        bundle: true,
        write: false,
        format: "iife",
        platform: "browser",
        conditions: ["browser"],
        plugins: [
            {
                name: "actual-renderer-with-isolated-stores",
                setup(builder) {
                    builder.onResolve({ filter: /.*/ }, (args) => (args.importer === renderer && mocks[args.path] ? { path: args.path, namespace: "fixture-mock" } : undefined))
                    builder.onLoad({ filter: /.*/, namespace: "fixture-mock" }, (args) => ({ contents: mocks[args.path], resolveDir: root }))
                    builder.onLoad({ filter: /\.svelte$/ }, async (args) => {
                        const source = await preprocess(readFileSync(args.path, "utf8"), sveltePreprocess({ typescript: { tsconfigFile: false } }), { filename: args.path })
                        const output = compile(source.code, { filename: args.path, css: true, dev: false })
                        return { contents: output.js.code, resolveDir: resolve(args.path, "..") }
                    })
                }
            }
        ]
    })
    bundle = result.outputFiles[0].text
})

function item(separateWrappedLines?: boolean, values = ["selamat datang di kota Bitung Kota Cakalang Indah Bitung"]) {
    return {
        type: "text",
        textFit: "none",
        style: "",
        specialStyle: { lineBg: "#000000", lineRadius: 4, lineGap: 12, ...(separateWrappedLines === undefined ? {} : { separateWrappedLines }) },
        lines: values.map((value) => ({ align: "text-align:center;", text: [{ value, style: "font-family:Arial;font-size:36px;line-height:1.2;" }] }))
    }
}

test.beforeEach(async ({ page }) => {
    const errors: string[] = []
    pageErrors.set(page, errors)
    page.on("pageerror", (error) => errors.push(error.message))
    await page.setContent('<style>body{margin:0}#target{width:520px;height:400px;font-family:Arial}</style><div id="target"></div>')
    await page.addScriptTag({ content: bundle })
})

test.afterEach(async ({ page }) => {
    expect(pageErrors.get(page)).toEqual([])
})

test("default and off keep the original single block", async ({ page }) => {
    for (const flag of [undefined, false]) {
        await page.evaluate((data) => (window as any).mount(data), item(flag))
        await expect(page.locator(".break")).toHaveCount(1)
        await expect(page.locator("[data-wrap-row]")).toHaveCount(0)
        await expect(page.locator(".break")).toHaveCSS("background-color", "rgb(0, 0, 0)")
    }
})

test("slide setting reaches the rendered preview through an older output template", async ({ page }) => {
    const template = item(undefined)
    template.specialStyle = { lineBg: "#000000", lineGap: 20, lineRadius: 4 }
    for (const enabled of [false, true]) {
        const slide = item(enabled)
        slide.specialStyle = { separateWrappedLines: enabled } as any
        const merged = mergeForTest([slide], [template], true, true, false, "", {}, true)[0]
        await page.evaluate((data) => (window as any).mount(data), merged)
        await expect(page.locator("[data-wrap-row]")).toHaveCount(enabled ? 2 : 0)
        if (enabled) {
            // Row nodes can exist while their parent is hidden and layout is zero.
            await expect
                .poll(
                    async () => {
                        const rows = await page.locator("[data-wrap-row]").evaluateAll((nodes) =>
                            nodes.map((node) => {
                                const r = node.getBoundingClientRect(),
                                    style = getComputedStyle(node)
                                return { width: r.width, height: r.height, top: r.top, bottom: r.bottom, visible: style.display !== "none" && style.visibility === "visible" }
                            })
                        )
                        return rows.length === 2 && rows.every((row) => row.visible && row.width > 0 && row.height > 0) && Math.abs(rows[1].top - rows[0].bottom - 20) < 0.05
                    },
                    { timeout: 5000 }
                )
                .toBe(true)
        }
        expect(slide.specialStyle.separateWrappedLines).toBe(enabled)
        expect(template.specialStyle.separateWrappedLines).toBeUndefined()
    }
})

test("on creates full-width row blocks with Enter-equivalent spacing", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text())
    })
    const data = item(true)
    await page.evaluate((data) => (window as any).mount(data), data)
    await expect(page.locator("[data-wrap-row]")).toHaveCount(2)
    await expect(page.locator(".break")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
    await expect(page.locator(".break > .textContainer")).toBeHidden()
    const rows = await page.locator("[data-wrap-row]").evaluateAll((nodes) =>
        nodes.map((node) => {
            const r = node.getBoundingClientRect()
            return { width: r.width, top: r.top, bottom: r.bottom, text: node.textContent }
        })
    )
    expect(rows.map((row) => row.width)).toEqual([520, 520])
    expect(rows.map((row) => row.text).join("")).toBe(data.lines[0].text[0].value)
    expect(rows[1].top - rows[0].bottom).toBeCloseTo(12, 1)
    await expect(page.locator("[data-wrap-row]").first()).toHaveCSS("background-color", "rgb(0, 0, 0)")
    await expect(page.locator("[data-wrap-row]").last()).toHaveCSS("background-color", "rgb(0, 0, 0)")
    expect(await page.evaluate(() => (window as any).savedItem)).toEqual(data)
    expect(errors).toEqual([])
})

test("off restores the original DOM and on follows width and font changes", async ({ page }) => {
    await page.evaluate((data) => (window as any).mount(data), item(true))
    await expect(page.locator("[data-wrap-row]")).toHaveCount(2)
    await page.locator("#target").evaluate((node) => (node.style.width = "1100px"))
    await expect(page.locator("[data-wrap-row]")).toHaveCount(1)
    await page.locator("#target").evaluate((node) => (node.style.width = "340px"))
    await expect.poll(() => page.locator("[data-wrap-row]").count()).toBeGreaterThan(2)
    await page.evaluate((data) => (window as any).update({ item: data }), item(false))
    await expect(page.locator("[data-wrap-row]")).toHaveCount(0)
    await expect(page.locator(".break > .textContainer")).toBeVisible()
    await expect(page.locator(".break")).toHaveCSS("background-color", "rgb(0, 0, 0)")
})

test("preserves mixed styles, Unicode, explicit breaks, and blank lines", async ({ page }) => {
    const data = item(true, ["", "Kasih 😀 祢的恩典 sangat indah dan besar untuk kita semua", "Last line"])
    data.lines[1].text = [
        { value: "Kasih 😀 祢的恩典 ", style: "font-family:Arial;font-size:36px;color:red;line-height:1.2;" },
        { value: "sangat indah dan besar untuk kita semua", style: "font-family:Arial;font-size:36px;font-weight:bold;line-height:1.2;" }
    ]
    await page.evaluate((data) => (window as any).mount(data), data)
    await expect.poll(() => page.locator("[data-wrap-row]").count()).toBeGreaterThan(3)
    const rows = page.locator("[data-wrap-row]")
    expect((await rows.allTextContents()).join("")).toContain("Kasih 😀 祢的恩典")
    expect(await rows.locator('[style*="color:red"]').count()).toBeGreaterThan(0)
    expect(await page.evaluate(() => (window as any).savedItem)).toEqual(data)
})

test("updates dynamic values and works in scrolling copies", async ({ page }) => {
    await page.evaluate((data) => {
        ;(window as any).dynamicTitle = data.lines[0].text[0].value
        data.lines[0].text[0].value = "{title}"
        ;(window as any).mount({ ...data, scrolling: { type: "top_bottom", gap: 0 } })
    }, item(true))
    await expect.poll(() => page.locator("[data-wrap-row]").count()).toBeGreaterThan(1)
    await page.evaluate(() => ((window as any).dynamicTitle = "Short"))
    await expect(page.locator("[data-wrap-row]").first()).toHaveText("Short")
    await expect(page.locator(".scrollContent").first().locator("[data-wrap-row]")).toHaveCount(1)
})

test("autosize measures reflowing visual rows rather than frozen row clones", async ({ page }) => {
    const data = item(true)
    await page.locator("#target").evaluate((node) => (node.style.height = "90px"))
    await page.evaluate((data) => (window as any).mount(data), data)
    await expect(page.locator("[data-wrap-row]")).toHaveCount(2)
    const fontSize = await page.evaluate(() => (window as any).measureAutoSize({ type: "growToFit", defaultFontSize: 36, maxFontSize: 36, minFontSize: 10 }))
    expect(fontSize).toBeGreaterThanOrEqual(25)
    expect(fontSize).toBeLessThan(36)
})

test("editor and output autosize agree while the live editing DOM stays intact", async ({ page }) => {
    await page.locator("#target").evaluate((node) => (node.style.height = "90px"))
    await page.evaluate((data) => (window as any).mount(data), item(true))
    await expect(page.locator("[data-wrap-row]")).toHaveCount(2)
    const sizes = await page.evaluate(() => {
        const options = { type: "growToFit", defaultFontSize: 36, maxFontSize: 36, minFontSize: 10 }
        return {
            output: (window as any).measureAutoSize(options),
            editor: (window as any).measureEditorSize(options, { enabled: true, gap: 12, background: "#000000", radius: 4 })
        }
    })
    expect(sizes.editor).toBeCloseTo(sizes.output, 3)
})

test("font changes reflow rows and Text on one line keeps its priority", async ({ page }) => {
    const data = item(true)
    await page.evaluate((data) => (window as any).mount(data), data)
    await expect(page.locator("[data-wrap-row]")).toHaveCount(2)
    await page.evaluate(() => (window as any).update({ fontSize: 18 }))
    await expect(page.locator("[data-wrap-row]")).toHaveCount(1)
    data.lines[0].text[0].style += "white-space:nowrap;"
    await page.evaluate((data) => (window as any).update({ item: data, fontSize: 36 }), data)
    await expect(page.locator("[data-wrap-row]")).toHaveCount(1)
})

test("output reflows after a hidden host is resized and revealed", async ({ page }) => {
    const template = item(undefined)
    template.specialStyle = { lineBg: "#000000", lineGap: 20, lineRadius: 4 }
    const slide = item(true)
    slide.specialStyle = { separateWrappedLines: true } as any
    const merged = mergeForTest([slide], [template], true, true, false, "", {}, true)[0]
    const original = merged.lines[0].text.map((part: any) => part.value).join("")
    await page.evaluate((data) => (window as any).mount(data), merged)
    await expect(page.locator("[data-wrap-row]")).toHaveCount(2)
    await page.locator("#target").evaluate((node: HTMLElement) => {
        node.style.display = "none"
        node.style.width = "260px"
    })
    await expect(page.locator("#target")).toBeHidden()
    await expect.poll(() => page.locator("#target").evaluate((node) => node.getBoundingClientRect().width)).toBe(0)
    await page.locator("#target").evaluate((node: HTMLElement) => {
        node.style.display = ""
    })
    await expect
        .poll(
            async () => {
                const rows = await page.locator("[data-wrap-row]").evaluateAll((nodes) =>
                    nodes.map((node) => {
                        const r = node.getBoundingClientRect(),
                            style = getComputedStyle(node)
                        return { width: r.width, height: r.height, top: r.top, bottom: r.bottom, text: node.textContent || "", visible: style.display !== "none" && style.visibility === "visible" }
                    })
                )
                return rows.length > 2 && rows.every((row) => row.visible && row.text.trim().length > 0 && Math.abs(row.width - 260) < 0.05 && row.height > 0) && rows.slice(1).every((row, index) => Math.abs(row.top - rows[index].bottom - 20) < 0.05)
            },
            { timeout: 5000 }
        )
        .toBe(true)
    const saved = await page.evaluate(() => (window as any).savedItem.lines)
    expect(saved).toHaveLength(1)
    expect(saved[0].text.map((part: any) => part.value).join("")).toBe(original)
})
