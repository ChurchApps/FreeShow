import { expect, test, type Locator } from "@playwright/test"
import { clickSafe as click, createProject, createShow, launchApp, MOD, pressGlobal as press, type TestApp } from "./appHelpers"

// Selecting slides and project items, and the keyboard shortcuts that act on the selection.

const PROJECT_ITEM = 'div.selectElem[id="show"]'
const SLIDE = 'div.selectElem[id="slide"]'

let t: TestApp

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
    test.setTimeout(120_000)
    t = await launchApp()
    await createProject(t.win)
    await createShow(t.win, "Song A")
    await createShow(t.win, "Song B")
    await createShow(t.win, "Song C")
})

test.afterAll(async () => {
    await t?.close()
})

const clickSafe = (target: Locator, options?: Parameters<Locator["click"]>[0]) => click(t.win, target, options)
const pressGlobal = (keys: string) => press(t.win, keys)
const locator = (selector: string) => t.win.locator(selector)

const selectedIndexes = (selectId: string) => t.win.evaluate((id) => [...document.querySelectorAll(`.selectElem.isSelected[id="${id}"]`)].map((elem) => JSON.parse((elem as HTMLElement).dataset.item || "{}").index as number).sort((a, b) => a - b), selectId)
const projectNames = async () => (await locator(PROJECT_ITEM).allInnerTexts()).map((text) => text.trim().split("\n")[0])

test("Shift+click after a plain click selects the whole range", async () => {
    const slides = locator(SLIDE)
    await clickSafe(slides.nth(0)) // plays the slide, does not select it
    await clickSafe(slides.nth(2), { modifiers: ["Shift"] })
    expect(await selectedIndexes("slide")).toEqual([0, 1, 2])

    await clickSafe(slides.nth(3), { modifiers: [MOD] })
    expect(await selectedIndexes("slide")).toEqual([0, 1, 2, 3])
})

test("a plain click on a slide in the show view still only plays it", async () => {
    await pressGlobal("Escape") // clear the selection from the previous test
    await expect.poll(() => selectedIndexes("slide")).toEqual([])
    await clickSafe(locator(SLIDE).nth(1))
    expect(await selectedIndexes("slide")).toEqual([])
})

test("a plain click selects a project item and the selection follows the arrow keys", async () => {
    await clickSafe(locator(PROJECT_ITEM).nth(0))
    expect(await selectedIndexes("show")).toEqual([0])

    await pressGlobal("ArrowDown")
    expect(await selectedIndexes("show")).toEqual([1])
})

test("project items: copy pastes after the selection and can be undone", async () => {
    expect(await projectNames()).toEqual(["Song A", "Song B", "Song C"])

    await clickSafe(locator(PROJECT_ITEM).nth(1))
    await pressGlobal(`${MOD}+c`)
    expect(await selectedIndexes("show")).toEqual([1]) // copying must not change the selection
    await pressGlobal(`${MOD}+v`)
    expect(await projectNames()).toEqual(["Song A", "Song B", "Song B", "Song C"])

    await pressGlobal(`${MOD}+z`)
    expect(await projectNames()).toEqual(["Song A", "Song B", "Song C"])
})

test("project items: duplicate, rename and remove with the keyboard", async () => {
    await clickSafe(locator(PROJECT_ITEM).nth(2))
    await pressGlobal(`${MOD}+d`)
    expect(await projectNames()).toEqual(["Song A", "Song B", "Song C", "Song C"])

    await clickSafe(locator(PROJECT_ITEM).last())
    await pressGlobal("Delete")
    expect(await projectNames()).toEqual(["Song A", "Song B", "Song C"])

    await clickSafe(locator(PROJECT_ITEM).nth(0))
    await pressGlobal("F2")
    const input = locator(`${PROJECT_ITEM} input`)
    await expect(input).toHaveCount(1)
    await input.fill("Song A renamed")
    await input.press("Enter")
    await expect.poll(projectNames).toEqual(["Song A renamed", "Song B", "Song C"])
})

test("project items: a plain click inside a multi-selection keeps only the clicked item", async () => {
    await clickSafe(locator(PROJECT_ITEM).nth(0))
    await clickSafe(locator(PROJECT_ITEM).nth(2), { modifiers: [MOD] })
    expect(await selectedIndexes("show")).toEqual([0, 2])

    await clickSafe(locator(PROJECT_ITEM).nth(2))
    expect(await selectedIndexes("show")).toEqual([2])
})

test("editor: a plain click selects the slide, clicking an item moves the focus to the item", async () => {
    await clickSafe(t.win.getByText("Edit", { exact: true }).first())
    await expect(locator(".editItem").first()).toBeVisible()

    const slides = locator(SLIDE)
    await expect(slides.nth(1)).toBeVisible() // the slide list renders after the editor
    const slideCount = await slides.count()
    await clickSafe(slides.nth(1))
    expect(await selectedIndexes("slide")).toEqual([1])

    await pressGlobal(`${MOD}+d`)
    await expect(slides).toHaveCount(slideCount + 1)

    // clicking a text box border selects the item instead, so Ctrl+D duplicates the item and not the slide
    const items = locator(".editItem")
    const itemCount = await items.count()
    await clickSafe(items.first(), { position: { x: 3, y: 3 } }) // the border, not the text
    await expect.poll(() => selectedIndexes("slide")).toEqual([])
    await pressGlobal(`${MOD}+d`)
    await expect(items).toHaveCount(itemCount + 1)
    await expect(slides).toHaveCount(slideCount + 1)
})

test("editor: Delete with a text box selected removes the text box, not the selected slide", async () => {
    const slides = locator(SLIDE)
    const items = locator(".editItem")
    await clickSafe(slides.nth(0))
    expect(await selectedIndexes("slide")).toEqual([0])

    // clicking the text selects the item but keeps the slide selection (styling applies to all selected slides)
    await expect(items.first()).toBeVisible()
    const itemCount = await items.count()
    const slideCount = await slides.count()
    await clickSafe(items.first())
    await expect.poll(() => selectedIndexes("slide")).toEqual([0])

    await pressGlobal("Delete")
    await expect(items).toHaveCount(itemCount - 1)
    await expect(slides).toHaveCount(slideCount)
})

test("focus mode: the project item selection follows the arrow keys", async () => {
    await clickSafe(t.win.getByText("Show", { exact: true }).first())
    await pressGlobal(`${MOD}+Shift+f`)
    await expect(locator(".main.focusMode")).toHaveCount(1)

    await clickSafe(locator(PROJECT_ITEM).nth(0))
    expect(await selectedIndexes("show")).toEqual([0])
    await pressGlobal("ArrowDown")
    expect(await selectedIndexes("show")).toEqual([1])

    await pressGlobal(`${MOD}+Shift+f`)
    await expect(locator(".main.focusMode")).toHaveCount(0)
})
