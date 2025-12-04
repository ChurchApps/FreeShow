<script lang="ts">
    import type { Line, SlideData } from "../../../../types/Show"
    import { activePopup, activeShow, customScriptureBooks, drawerTabsData, effectsLibrary, scripturesCache, selected, showsCache } from "../../../stores"
    import { clone, removeDuplicates } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getLayoutRef } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    let list: string[] = []
    $: {
        list = []
        let selectionData = $selected.data
        if (!Array.isArray(selectionData)) selectionData = []

        if (($activeShow && $selected.id === "slide") || $selected.id === "group") {
            selectionData.forEach((a, i) => {
                let slide = a.id ? a : getLayoutRef()[a.index]
                if (!slide) return

                if (slide.parent) slide = slide.parent.id
                else slide = slide.id
                let name: string = $showsCache[$activeShow!.id].slides[slide].group || ""
                if (name === ".") name = ""
                list.push(name || "—")
                if (i === 0) groupName = name
            })
            list = removeDuplicates(list)
        } else if ($selected.id === "chord") {
            groupName = selectionData[0]?.chord?.key || ""
        } else if ($selected.id === "bible_book") {
            const scriptureId = $drawerTabsData.scripture?.activeSubTab || ""
            const activeBible = $scripturesCache[scriptureId]
            const bookIndex = selectionData[0]?.index - 1
            const book = activeBible.books?.[bookIndex] || {}
            groupName = (book as any).customName || book.name || ""
        } else if (selectionData[0]?.name) {
            groupName = selectionData[0].name
        }
    }

    const renameAction = {
        slide: () => {
            const ref = getLayoutRef()

            // get selected ids
            let ids: string[] = []
            $selected.data.forEach(a => {
                const id = a.id || ref[a.index]?.id
                ids.push(id)
            })

            // remove duplicates
            ids = [...new Set(ids)]

            // remove children if parent is selected
            ids.map(id => {
                const slide = _show().slides([id]).get()[0]
                if (slide.children?.length) ids = ids.filter(id => !slide.children.includes(id))
            })

            // get slide refs
            let refs: any[] = []
            ids.forEach(id => {
                refs.push(ref.find(a => a.id === id))
            })

            // sort by last index first
            refs = refs.sort((a, b) => b.layoutIndex - a.layoutIndex)

            // WIP index might become incorrect when multiple slides are renamed at once (if index changes)

            // TODO: history (x3)
            refs.forEach(ref => {
                const slideId = ref.id

                // remove global group if active
                if ($activeShow && $showsCache[$activeShow.id].slides[slideId].globalGroup) history({ id: "UPDATE", newData: { data: null, key: "slides", keys: [slideId], subkey: "globalGroup" }, oldData: { id: $activeShow?.id }, location: { page: "show", id: "show_key" } })

                history({ id: "UPDATE", newData: { data: groupName, key: "slides", keys: [slideId], subkey: "group" }, oldData: { id: $activeShow?.id }, location: { page: "show", id: "show_key" } })

                if (!ref?.parent) return
                // make child a parent

                let children = _show().slides([ref.parent.id]).get("children")[0]
                let offsetIndex: number = ref.parent.index - children.indexOf(ref.id)

                // remove renamed child
                history({
                    id: "UPDATE",
                    newData: { data: children.filter((a: string) => a !== ref.id), key: "slides", keys: [ref.parent.id], subkey: "children" },
                    oldData: { id: $activeShow?.id },
                    location: { page: "show", id: "show_key" }
                })

                let currentLayouts: SlideData[][] = _show().layouts().get("slides")
                let layoutIds: string[] = Object.keys($showsCache[$activeShow!.id].layouts)
                let newLayouts: { [key: string]: SlideData[] } = {}

                currentLayouts.forEach((layout, i: number) => {
                    let l: SlideData[] = []

                    let added = false
                    layout.forEach((slide, index: number) => {
                        l.push(slide)

                        if (added || index + 1 < offsetIndex || slide.id !== ref.parent?.id) return
                        added = true

                        l.push({ id: ref.id, ...(slide.children?.[ref.id] || {}) })
                    })

                    newLayouts[layoutIds[i]] = l
                })

                // set updated layout slides
                history({ id: "UPDATE", newData: { key: "layouts", keys: layoutIds, subkey: "slides", data: newLayouts }, oldData: { id: $activeShow?.id }, location: { page: "show", id: "show_key" } })
            })
        },
        group: () => {
            $selected.data.forEach(a => {
                const slideId = a.id

                // remove global group if active
                if ($activeShow && $showsCache[$activeShow.id].slides[slideId].globalGroup) history({ id: "UPDATE", newData: { data: null, key: "slides", keys: [slideId], subkey: "globalGroup" }, oldData: { id: $activeShow?.id }, location: { page: "show", id: "show_key" } })

                history({ id: "UPDATE", newData: { data: groupName, key: "slides", keys: [slideId], subkey: "group" }, oldData: { id: $activeShow?.id }, location: { page: "show", id: "show_key" } })
            })
        },
        chord: () => {
            let chord = $selected.data[0]
            let lines: Line[] = _show().slides([chord.slideId]).items([chord.itemIndex]).get("lines")[0][0]

            // create first
            if (!chord.chord) return

            let newLines = clone(lines)
            let chords = newLines[chord.index].chords
            chords?.forEach((a, i: number) => {
                if (a.id === chord.chord.id) newLines[chord.index].chords![i].key = groupName
            })

            _show()
                .slides([chord.slideId])
                .items([chord.itemIndex])
                .set({ key: "lines", values: [newLines] })
        },
        audio_effect: () => {
            let selectedPath = $selected.data?.[0]?.path
            effectsLibrary.update(a => {
                let index = a.findIndex(a => a.path === selectedPath)
                if (index > -1) a[index].name = groupName
                return a
            })
        },
        bible_book: () => {
            const scriptureId = $drawerTabsData.scripture?.activeSubTab || ""
            const bookIndex = $selected.data[0]?.index - 1
            scripturesCache.update((a: any) => {
                if (!a[scriptureId]?.books?.[bookIndex]) return a

                a[scriptureId].books[bookIndex].customName = groupName
                return a
            })

            // update in drawer real time
            customScriptureBooks.update(a => {
                if (!a[scriptureId]) a[scriptureId] = []
                a[scriptureId][bookIndex] = groupName
                return a
            })
        }
    }

    function rename() {
        if ($selected.id && renameAction[$selected.id]) renameAction[$selected.id]()
        activePopup.set(null)
        groupName = ""
        selected.set({ id: null, data: [] })
    }

    let groupName = ""

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            setTimeout(rename)
        }
    }
</script>

<svelte:window on:keydown={keydown} />

{#if list.length > 1}
    <p><T id="popup.change_name" />:</p>
    <ul style="list-style-position: inside;margin-bottom: 20px;">
        {#each list as text}
            <li style="font-weight: bold;">{text}</li>
        {/each}
    </ul>
{/if}

<MaterialTextInput label="inputs.name" value={groupName} on:change={e => (groupName = e.detail)} autoselect />

<MaterialButton variant="contained" style="margin-top: 20px;" icon="edit" on:click={rename}>
    <T id="actions.rename" />
</MaterialButton>
