<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, activeShow, globalTags, outputs, overlays, selected, showsCache, templates } from "../../../stores"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { _show } from "../../helpers/shows"
    import Button from "../../inputs/Button.svelte"
    import Color from "../../inputs/Color.svelte"
    import T from "../../helpers/T.svelte"

    let value: any = "#FFFFFF"
    $: console.log(value)
    onMount(() => {
        if ($selected.id === "slide") {
            let firstSelected = $selected.data[0]
            let ref = _show("active").layouts("active").ref()[0][firstSelected.index]
            if (ref.type === "child") ref = ref.parent
            value = _show("active").slides([ref.id]).get("color")
        } else if ($selected.id === "group") {
            value = _show("active").slides([$selected.data[0].id]).get("color")
        } else if ($selected.id === "overlay") value = $overlays[$selected.data[0]].color
        else if ($selected.id === "template") value = $templates[$selected.data[0]].color
        else if ($selected.id === "output") value = $outputs[$selected.data[0].id].color
        else if ($selected.id === "tag") value = $globalTags[$selected.data[0].id].color
    })

    const actions: any = {
        slide: () => {
            $selected.data.forEach((a) => {
                let ref = a.id ? { id: a.id } : _show("active").layouts("active").ref()[0][a.index]
                if (ref.type === "child") ref = ref.parent
                console.log(ref)

                // remove global group if active
                if ($activeShow && $showsCache[$activeShow.id].slides[ref.id].globalGroup)
                    history({ id: "UPDATE", newData: { data: null, key: "slides", keys: [ref.id], subkey: "globalGroup" }, oldData: { id: $activeShow?.id }, location: { page: "show", id: "show_key" } })

                history({ id: "UPDATE", newData: { data: value, key: "slides", keys: [ref.id], subkey: "color" }, oldData: { id: $activeShow?.id }, location: { page: "show", id: "show_key" } })
            })
        },
        group: () => actions.slide(),
        overlay: () => {
            $selected.data.forEach((id) => {
                history({ id: "UPDATE", newData: { key: "color", data: value }, oldData: { id }, location: { page: "drawer", id: "overlay_color" } })
            })
        },
        template: () => {
            $selected.data.forEach((id) => {
                history({ id: "UPDATE", newData: { key: "color", data: value }, oldData: { id }, location: { page: "drawer", id: "template_color" } })
            })
        },
        output: () => {
            outputs.update((a) => {
                $selected.data.forEach(({ id }) => {
                    a[id].color = value
                })

                return a
            })
        },
        tag: () => {
            globalTags.update((a) => {
                let id = $selected.data[0]?.id || ""
                if (a[id]) a[id].color = value

                return a
            })
        },
    }

    function updateColor() {
        if ($selected.id) actions[$selected.id]()
        activePopup.set(null)
    }
</script>

<Color {value} on:input={(e) => (value = e.detail)} visible />

<br />

<Button on:click={updateColor} dark center>
    <Icon id="save" size={1.2} right />
    <T id="actions.save" />
</Button>
