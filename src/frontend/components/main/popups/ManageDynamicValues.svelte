<script lang="ts">
    import { special } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { clone } from "../../helpers/array"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialCheckbox from "../../inputs/MaterialCheckbox.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    const alwaysEnabledIds = ["time", "show", "$"]
    const toggleSections = ["time", "project", "show", "slide_text", "video", "audio", "meta", "timer", "rss", "$"]
    function getTitle(id: string) {
        if (id === "time") return "timer.time"
        if (id === "project") return "guide_title.project"
        if (id === "show") return "guide_title.show"
        if (id === "slide_text") return "edit.text"
        if (id === "video") return "edit.video"
        if (id === "audio") return "tools.audio"
        if (id === "meta") return "tools.metadata"
        if (id === "timer") return "items.timer"
        if (id === "rss") return "settings.rss"
        if (id === "$") return "items.variable"
        return ""
    }

    let hidden: string[] = $special.disabledDynamicValues || []

    function toggleHidden(key: string) {
        if (hidden.includes(key)) hidden.splice(hidden.indexOf(key), 1)
        else hidden.push(key)

        hidden = hidden
        special.update((a) => {
            a.disabledDynamicValues = hidden
            return a
        })
    }

    // RSS

    type RSS = {
        name: string
        url: string
        count: number
        divider?: string
        updateInterval?: string
    }

    const DEFAULT_RSS: RSS = { name: "", url: "", count: 5 }

    $: rssList = sortList($special.dynamicRSS || []) as RSS[]
    function sortList(list: any[]) {
        // this breaks "openedMenus"
        // return list.sort((a, b) => a.name.localeCompare(b.name))
        return list
    }

    function addRSS() {
        special.update((a) => {
            if (!a.dynamicRSS) a.dynamicRSS = []
            a.dynamicRSS.push(clone(DEFAULT_RSS))
            return a
        })

        const nextIndex = $special.dynamicRSS?.length - 1
        if (!openedMenus.includes(nextIndex)) {
            openedMenus.push(nextIndex)
            openedMenus = openedMenus
        }
    }

    function deleteItem(index: number) {
        if (openedMenus.includes(index)) toggleMenu(index)
        openedMenus = openedMenus.map((i) => (i > index ? i - 1 : i))

        special.update((a) => {
            if (!a.dynamicRSS) return a
            a.dynamicRSS.splice(index, 1)
            return a
        })
    }

    function setValue(e: any, index: number, key: string) {
        const value = e.detail

        special.update((a) => {
            if (!a.dynamicRSS?.[index]) return a

            a.dynamicRSS[index][key] = value
            return a
        })
    }

    // WIP duplicate of EffectTools.svelte
    let openedMenus: number[] = []
    function toggleMenu(index: number) {
        if (openedMenus.includes(index)) openedMenus.splice(openedMenus.indexOf(index), 1)
        else openedMenus.push(index)
        openedMenus = openedMenus
    }

    const updateIntervalList = [
        { value: "5", label: translateText("5 settings.minutes") },
        { value: "10", label: translateText("10 settings.minutes") },
        { value: "15", label: translateText("15 settings.minutes") },
        { value: "30", label: translateText("30 settings.minutes") },
        { value: "60", label: translateText("60 settings.minutes") },
        { value: "120", label: translateText("120 settings.minutes") },
        { value: "240", label: translateText("240 settings.minutes") }
    ]
</script>

<div>
    {#each toggleSections as section}
        {@const alwaysEnabled = alwaysEnabledIds.includes(section)}
        {@const alwaysDisabled = section === "rss" && !$special.dynamicRSS?.length}

        <MaterialCheckbox label={getTitle(section)} disabled={alwaysEnabled || alwaysDisabled} checked={alwaysDisabled ? false : alwaysEnabled || !hidden.includes(section)} on:change={() => toggleHidden(section)} />
    {/each}
</div>

<HRule title="settings.rss" />

{#each rssList as rss, i}
    <InputRow arrow>
        <MaterialTextInput label="inputs.name" value={rss.name} disabled={!!(rss.name && rss.url)} on:change={(e) => setValue(e, i, "name")} />

        <MaterialButton icon="delete" title="actions.delete" on:click={() => deleteItem(i)} white />

        <div slot="menu">
            <InputRow>
                <MaterialTextInput style="width: 75%;" label="inputs.url" value={rss.url} on:change={(e) => setValue(e, i, "url")} />
                <MaterialTextInput style="width: 25%;" label="meta.text_divider" value={rss.divider || " | "} on:change={(e) => setValue(e, i, "divider")} />
            </InputRow>

            <InputRow>
                <MaterialDropdown style="width: 75%;" label="edit.interval" options={updateIntervalList} value={rss.updateInterval || "60"} on:change={(e) => setValue(e, i, "updateInterval")} />
                <MaterialNumberInput style="width: 25%;" label="edit.count" value={rss.count || 5} min={1} max={1000} on:change={(e) => setValue(e, i, "count")} />
            </InputRow>
        </div>
    </InputRow>
{/each}

<MaterialButton variant="outlined" icon="add" on:click={addRSS}>
    <T id="settings.add" />
</MaterialButton>
