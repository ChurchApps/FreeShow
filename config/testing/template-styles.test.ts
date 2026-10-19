import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import type { ViteDevServer } from "vite"
import type { Item } from "../../src/types/Show"

let server: ViteDevServer
let baseURL: string

// The public merge helper imports browser-only audio/UI modules. Load those real
// modules in Chromium and replace only the Electron IPC boundary.
test.use({ channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL })

test.beforeAll(async () => {
    const { createServer } = await import("vite")
    const { svelte, vitePreprocess } = await import("@sveltejs/vite-plugin-svelte")
    server = await createServer({
        configFile: false,
        root: process.cwd(),
        plugins: [svelte({ configFile: false, preprocess: vitePreprocess() })],
        server: { host: "127.0.0.1", port: 0 },
        logLevel: "error"
    })
    await server.listen()
    baseURL = server.resolvedUrls!.local[0]
})

test.afterAll(async () => {
    await server?.close()
})

test.beforeEach(async ({ page }) => {
    await page.route("**/*", (route) => {
        const url = new URL(route.request().url())
        if (url.origin !== new URL(baseURL).origin) return route.abort()
        if (url.pathname === "/__template_test__") return route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body></body></html>" })
        return route.continue()
    })
    await page.addInitScript(() => {
        Object.assign(window, { api: { send() {}, receive() {}, removeListener() {} } })
    })
    await page.goto(new URL("/__template_test__", baseURL).href)
})

function textbox(value: string, textStyle: string, align = "text-align: center;"): Item {
    return {
        type: "text",
        style: "left: 10px;top: 20px;width: 600px;height: 200px;",
        align: "align-items: center;",
        textFit: "none",
        lines: [{ align, text: [{ value, style: textStyle }] }]
    }
}

async function mergeTemplate(page: Page, ...args: Parameters<typeof import("../../src/frontend/components/helpers/output").mergeWithTemplate>): Promise<Item[]> {
    return page.evaluate(async (args) => {
        const moduleURL = "/src/frontend/components/helpers/output.ts"
        const { mergeWithTemplate } = await import(/* @vite-ignore */ moduleURL)
        return mergeWithTemplate(...args)
    }, args)
}

test("applying a template styles an existing variable placeholder", async ({ page }) => {
    const slide = textbox("{$name}", "font-family: Arial;font-size: 32px;color: #ffffff;font-weight: normal;")
    const template = textbox("{$name}", "font-family: Georgia;font-size: 72px;color: #ff0000;font-weight: bold;", "text-align: right;")

    const result = await mergeTemplate(page, [slide], [template], true, true, true)

    expect(result).toMatchObject([
        {
            lines: [{ align: "text-align: right;", text: [{ value: "{$name}", style: "font-family: Georgia;font-size: 72px;color: #ff0000;font-weight: bold;" }] }]
        }
    ])
})

test("styling a variable placeholder preserves its original variable and surrounding text", async ({ page }) => {
    const slide = textbox("Speaker: {$speaker}", "font-size: 32px;")
    const template = textbox("Name: {$name}", "font-size: 72px;")

    const result = await mergeTemplate(page, [slide], [template], true, true, true)

    expect(result).toMatchObject([{ lines: [{ text: [{ value: "Speaker: {$speaker}", style: "font-size: 72px;" }] }] }])
})

test("a variable segment can explicitly opt out of template formatting", async ({ page }) => {
    const slide = textbox("{$name}", "font-size: 32px;color: #ffffff;")
    slide.lines![0].text[0].customType = "disableTemplate"
    const template = textbox("{$name}", "font-size: 72px;color: #ff0000;")

    const result = await mergeTemplate(page, [slide], [template], true, true, true)

    expect(result).toMatchObject([{ lines: [{ text: [{ value: "{$name}", style: "font-size: 32px;color: #ffffff;", customType: "disableTemplate" }] }] }])
})

test("item-only templates leave variable text formatting unchanged", async ({ page }) => {
    const slide = textbox("{$name}", "font-size: 32px;")
    const template = textbox("{$name}", "font-size: 72px;", "text-align: right;")
    template.style = "left: 100px;top: 200px;width: 800px;height: 300px;"

    const result = await mergeTemplate(page, [slide], [template], true, true, true, "item")

    expect(result).toMatchObject([{ style: "left: 100px;top: 200px;width: 800px;height: 300px;", lines: [{ align: "text-align: center;", text: [{ value: "{$name}", style: "font-size: 32px;" }] }] }])
})

test("a template styles body text and variable text independently", async ({ page }) => {
    const slides = [textbox("Welcome", "font-size: 32px;"), textbox("Speaker: {$speaker}", "font-size: 20px;")]
    const templates = [textbox("Body", "font-size: 72px;color: #ff0000;"), textbox("Name: {$name}", "font-size: 24px;color: #ffff00;")]

    const result = await mergeTemplate(page, slides, templates, true, true, true)

    expect(result).toMatchObject([{ lines: [{ text: [{ value: "Welcome", style: "font-size: 72px;color: #ff0000;" }] }] }, { lines: [{ text: [{ value: "Speaker: {$speaker}", style: "font-size: 24px;color: #ffff00;" }] }] }])
})

test("new placeholders introduced by a template retain their formatting", async ({ page }) => {
    const template = textbox("{$name}", "font-size: 72px;color: #ff0000;", "text-align: right;")

    const result = await mergeTemplate(page, [], [template], true, true, true)

    expect(result).toMatchObject([{ lines: [{ align: "text-align: right;", text: [{ value: "{$name}", style: "font-size: 72px;color: #ff0000;" }] }] }])
})

test("output-style templates format placeholders without changing their variables", async ({ page }) => {
    const slide = textbox("{$speaker}", "font-size: 32px;color: #ffffff;")
    const template = textbox("{$name}", "font-size: 72px;color: #ff0000;", "text-align: right;")

    const result = await mergeTemplate(page, [slide], [template])

    expect(result).toMatchObject([{ lines: [{ align: "text-align: right;", text: [{ value: "{$speaker}", style: "font-size: 72px;color: #ff0000;" }] }] }])
})
