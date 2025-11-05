<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, activeProject, activeShow, effects, globalTags, outputs, overlays, profiles, projects, selected, showsCache, templates } from "../../../stores"
    import { history } from "../../helpers/history"
    import { getLayoutRef } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"

    let value = "#FFFFFF"
    let allowEmpty = $selected.id === "show" // || $selected.id === "slide"

    const selection = $selected

    onMount(() => {
        if (selection.id === "slide") {
            let firstSelected = selection.data[0]
            let ref: any = getLayoutRef()[firstSelected.index]
            if (!ref) return

            if (ref.type === "child") ref = ref.parent
            value = _show().slides([ref.id]).get("color")[0] || ""
        } else if (selection.id === "group") {
            value = _show().slides([selection.data[0].id]).get("color")[0] || ""
        } else if (selection.id === "overlay") value = $overlays[selection.data[0]].color || ""
        else if (selection.id === "template") value = $templates[selection.data[0]].color || ""
        else if (selection.id === "effect") value = $effects[selection.data[0]].color || ""
        else if (selection.id === "output") value = $outputs[selection.data[0].id].color || ""
        else if (selection.id === "profile") value = $profiles[selection.data[0].id].color || ""
        else if (selection.id === "tag") value = $globalTags[selection.data[0].id].color || ""
        else if (selection.id === "show") value = $projects[$activeProject || ""]?.shows?.[selection.data[0].index]?.color || ""
    })

    const actions = {
        slide: () => {
            selection.data.forEach((a) => {
                let ref: any = a.id ? { id: a.id } : getLayoutRef()[a.index]
                if (!ref) return

                if (ref.type === "child") ref = ref.parent

                // remove global group if active
                if ($activeShow && $showsCache[$activeShow.id].slides[ref.id].globalGroup)
                    history({ id: "UPDATE", newData: { data: null, key: "slides", keys: [ref.id], subkey: "globalGroup" }, oldData: { id: $activeShow?.id }, location: { page: "show", id: "show_key" } })

                history({ id: "UPDATE", newData: { data: value, key: "slides", keys: [ref.id], subkey: "color" }, oldData: { id: $activeShow?.id }, location: { page: "show", id: "show_key", override: "color" } })
            })
        },
        group: () => actions.slide(),
        overlay: () => {
            selection.data.forEach((id) => {
                history({ id: "UPDATE", newData: { key: "color", data: value }, oldData: { id }, location: { page: "drawer", id: "overlay_color", override: "color" } })
            })
        },
        template: () => {
            selection.data.forEach((id) => {
                history({ id: "UPDATE", newData: { key: "color", data: value }, oldData: { id }, location: { page: "drawer", id: "template_color", override: "color" } })
            })
        },
        effect: () => {
            selection.data.forEach((id) => {
                history({ id: "UPDATE", newData: { key: "color", data: value }, oldData: { id }, location: { page: "drawer", id: "effect_key", override: "color" } })
            })
        },
        output: () => {
            outputs.update((a) => {
                selection.data.forEach(({ id }) => {
                    a[id].color = value
                })

                return a
            })
        },
        profile: () => {
            profiles.update((a) => {
                selection.data.forEach(({ id }) => {
                    a[id].color = value
                })

                return a
            })
        },
        tag: () => {
            globalTags.update((a) => {
                let id = selection.data[0]?.id || ""
                if (a[id]) a[id].color = value

                return a
            })
        },
        show: () => {
            projects.update((a) => {
                if (!a[$activeProject || ""]?.shows) return a

                a[$activeProject || ""].shows[selection.data[0].index].color = value
                return a
            })
        }
    }

    function update(e) {
        value = e.detail
        if (selection.id && actions[selection.id]) actions[selection.id]()
    }
</script>

<MaterialButton class="popup-options" icon="edit" iconSize={1.1} title="create_show.more_options" on:click={() => activePopup.set("manage_colors")} white />

<MaterialColorInput label="" {value} on:input={update} {allowEmpty} alwaysVisible />
