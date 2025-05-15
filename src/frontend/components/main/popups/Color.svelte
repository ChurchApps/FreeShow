<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, activeProject, activeShow, globalTags, outputs, overlays, projects, selected, showsCache, templates } from "../../../stores"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { _show } from "../../helpers/shows"
    import Button from "../../inputs/Button.svelte"
    import Color from "../../inputs/Color.svelte"
    import T from "../../helpers/T.svelte"
    import { getLayoutRef } from "../../helpers/show"
    import CombinedInput from "../../inputs/CombinedInput.svelte"

    let value = "#FFFFFF"
    $: console.log(value)
    onMount(() => {
        if ($selected.id === "slide") {
            let firstSelected = $selected.data[0]
            let ref: any = getLayoutRef()[firstSelected.index]
            if (ref.type === "child") ref = ref.parent
            value = _show().slides([ref.id]).get("color")[0] || ""
        } else if ($selected.id === "group") {
            value = _show().slides([$selected.data[0].id]).get("color")[0] || ""
        } else if ($selected.id === "overlay") value = $overlays[$selected.data[0]].color || ""
        else if ($selected.id === "template") value = $templates[$selected.data[0]].color || ""
        else if ($selected.id === "output") value = $outputs[$selected.data[0].id].color
        else if ($selected.id === "tag") value = $globalTags[$selected.data[0].id].color
        else if ($selected.id === "show") value = $projects[$activeProject || ""]?.shows[$selected.data[0].index].color || ""
    })

    const actions = {
        slide: () => {
            $selected.data.forEach((a) => {
                let ref: any = a.id ? { id: a.id } : getLayoutRef()[a.index]
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
        show: () => {
            projects.update((a) => {
                if (!a[$activeProject || ""]?.shows) return a

                a[$activeProject || ""].shows[$selected.data[0].index].color = value
                return a
            })
        }
    }

    function updateColor() {
        if ($selected.id) actions[$selected.id]()
        activePopup.set(null)
    }
</script>

<Color {value} on:input={(e) => (value = e.detail)} visible />

<CombinedInput style="margin-top: 10px;">
    <Button on:click={updateColor} style="width: 100%;" dark center>
        <Icon id="save" size={1.2} right />
        <T id="actions.save" />
    </Button>
</CombinedInput>
