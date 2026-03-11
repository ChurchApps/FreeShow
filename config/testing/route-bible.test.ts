import assert from "node:assert/strict"
import test from "node:test"
import { buildRouteBibleUrl, hasRouteBibleReference } from "../../src/frontend/components/drawer/bible/routeBible"

test("Route Bible helper builds the expected URL", () => {
    assert.equal(buildRouteBibleUrl("John 3:16"), "https://route.bible/?q=John+3%3A16&utm_source=freeshow&utm_medium=link")
})

test("Route Bible actions only show when a reference label exists", () => {
    assert.equal(hasRouteBibleReference("Psalm 23"), true)
    assert.equal(hasRouteBibleReference(""), false)
})
