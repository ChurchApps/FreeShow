<script lang="ts">
    import { activePopup, activeShow, overlays, playerVideos, selected, showsCache, templates } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    let list: string[] = []
    $: {
        list = []
        if ($selected.id === "overlay") {
            list = [...new Set($selected.data.map((id) => $overlays[id].name))]
        } else if ($selected.id === "template") {
            list = [...new Set($selected.data.map((id) => $templates[id].name))]
        } else if (($activeShow && $selected.id === "slide") || $selected.id === "group") {
            $selected.data.forEach((a, i) => {
                let slide = a.id ? a : _show("active").layouts("active").ref()[0][a.index]
                if (slide.parent) slide = slide.parent.id
                else slide = slide.id
                let name: string = $showsCache[$activeShow!.id].slides[slide].group || ""
                list.push(name || "—")
                if (i === 0) groupName = name
            })
            list = [...new Set(list)]
        } else if ($selected.id === "player") {
            list = [...new Set($selected.data.map((id) => $playerVideos[id].name))]
        }
    }

    const renameAction: any = {
        slide: () => {
            // TODO: history (x3)
            $selected.data.forEach((a) => {
                let slide = a.id
                let ref = _show("active").layouts("active").ref()[0][a.index]
                if (!slide) slide = ref.id

                // remove global group if active
                if ($activeShow && $showsCache[$activeShow.id].slides[slide].globalGroup)
                    history({ id: "UPDATE", newData: { data: null, key: "slides", keys: [ref.id], subkey: "globalGroup" }, oldData: { id: $activeShow?.id }, location: { page: "show", id: "show_key" } })

                history({ id: "UPDATE", newData: { data: groupName, key: "slides", keys: [ref.id], subkey: "group" }, oldData: { id: $activeShow?.id }, location: { page: "show", id: "show_key" } })

                if (!ref?.parent) return
                // make child a parent

                let children = _show("active").slides([ref.parent.id]).get("children")[0]
                let offsetIndex: number = ref.parent.index - children.indexOf(ref.id)

                // remove renamed child
                history({
                    id: "UPDATE",
                    newData: { data: children.filter((a: string) => a !== ref.id), key: "slides", keys: [ref.parent.id], subkey: "children" },
                    oldData: { id: $activeShow?.id },
                    location: { page: "show", id: "show_key" },
                })

                let currentLayouts = _show().layouts().get("slides")
                let layoutIds: string[] = Object.keys($showsCache[$activeShow!.id].layouts)
                let newLayouts: any = {}

                currentLayouts.forEach((layout, i: number) => {
                    let l: any[] = []

                    // TODO: renaming multiple children with the same parent dont work properly

                    let added = false
                    layout.forEach((slide: any, index: number) => {
                        l.push(slide)

                        if (added || index + 1 < offsetIndex || slide.id !== ref.parent.id) return
                        added = true

                        l.push({ id: ref.id, ...(slide.children?.[ref.id] || {}) })
                    })

                    newLayouts[layoutIds[i]] = l
                })

                // set updated layout slides
                history({ id: "UPDATE", newData: { key: "layouts", keys: layoutIds, subkey: "slides", data: newLayouts }, oldData: { id: $activeShow?.id }, location: { page: "show", id: "show_key" } })
            })
        },
        group: () => renameAction.slide(),
        overlay: () => {
            $selected.data.forEach((id) => {
                history({ id: "UPDATE", newData: { key: "name", data: groupName }, oldData: { id }, location: { page: "drawer", id: "overlay_name" } })
            })
        },
        template: () => {
            $selected.data.forEach((id) => {
                history({ id: "UPDATE", newData: { key: "name", data: groupName }, oldData: { id }, location: { page: "drawer", id: "template_name" } })
            })
        },
        chord: () => {
            let chord = $selected.data[0]
            let lines = _show().slides([chord.slideId]).items([chord.itemIndex]).get("lines")[0][0]

            // create first
            if (!chord.chord) return

            let newLines = clone(lines)
            let chords = newLines[chord.index].chords
            chords.forEach((a: any, i: number) => {
                if (a.id === chord.chord.id) newLines[chord.index].chords[i].key = groupName
            })

            _show()
                .slides([chord.slideId])
                .items([chord.itemIndex])
                .set({ key: "lines", values: [newLines] })
        },
        player: () => {
            playerVideos.update((a) => {
                $selected.data.forEach((id) => {
                    a[id].name = groupName
                })

                return a
            })
        },
    }

    function rename() {
        if ($selected.id) renameAction[$selected.id]()
        activePopup.set(null)
        groupName = ""
        selected.set({ id: null, data: [] })
    }

    let groupName: string = ""
    const changeValue = (e: any) => (groupName = e.target.value)

    function keydown(e: any) {
        if (e.key === "Enter") {
            element.querySelector("input").blur()
            rename()
        }
    }

    let element: any
</script>

<svelte:window on:keydown={keydown} />

{#if list.length}
    <p><T id="popup.change_name" />:</p>
    <ul style="list-style-position: inside;">
        {#each list as text}
            <li style="font-weight: bold;">{text}</li>
        {/each}
    </ul>
{/if}

<div bind:this={element}>
    <TextInput autofocus value={groupName} {element} on:change={(e) => changeValue(e)} />
</div>

<Button style="height: auto;margin-top: 10px;" on:click={rename} center dark>
    <Icon id="edit" right />
    <T id="actions.rename" />
</Button>
