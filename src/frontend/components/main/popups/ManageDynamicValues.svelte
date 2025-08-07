<script lang="ts">
    import { dictionary, special } from "../../../stores"
    import { clone } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    const alwaysEnabledIds = ["time", "show", "$"]
    const toggleSections = ["time", "show", "slide_text", "video", "audio", "meta", "timer", "rss", "$"]
    function getTitle(id: string) {
        if (id === "time") return "timer.time"
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
        updateInterval?: number
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
        const value = e.target?.value || e.detail?.id || e.detail

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
        { id: "5", name: "5 $:settings.minutes:$" },
        { id: "10", name: "10 $:settings.minutes:$" },
        { id: "15", name: "15 $:settings.minutes:$" },
        { id: "30", name: "30 $:settings.minutes:$" },
        { id: "60", name: "60 $:settings.minutes:$" },
        { id: "120", name: "120 $:settings.minutes:$" },
        { id: "240", name: "240 $:settings.minutes:$" }
    ]
</script>

<div>
    {#each toggleSections as section}
        {@const alwaysEnabled = alwaysEnabledIds.includes(section)}
        <CombinedInput>
            <!-- class:faded={alwaysEnabled} -->
            <p class:faded={section === "rss" && !$special.dynamicRSS?.length} style="width: 100%;{hidden.includes(section) ? 'opacity: 0.5;' : ''}"><T id={getTitle(section)} /></p>
            {#if !alwaysEnabled && (section !== "rss" || $special.dynamicRSS?.length)}
                <Button style="min-width: 40px;" disabled={alwaysEnabled} on:click={() => toggleHidden(section)} center>
                    <Icon id={hidden.includes(section) ? "private" : "eye"} white={alwaysEnabled || hidden.includes(section)} />
                </Button>
            {/if}
        </CombinedInput>
    {/each}
</div>

<HRule title="settings.rss" />

<div>
    {#each rssList as rss, i}
        <CombinedInput style={i === 0 ? "" : "border-top: 2px solid var(--primary-lighter);"} textWidth={40}>
            <p><T id="inputs.name" /></p>
            <TextInput value={rss.name} disabled={!!rss.name} on:change={(e) => setValue(e, i, "name")} />

            <Button title={$dictionary.actions?.delete} on:click={() => deleteItem(i)} redHover>
                <Icon id="delete" white />
            </Button>

            <Button style="padding: 0 8.5px !important" class="submenu_open" on:click={() => toggleMenu(i)}>
                {#if openedMenus.includes(i)}
                    <Icon class="submenu_open" id="arrow_down" size={1.4} style="fill: var(--secondary);" />
                {:else}
                    <Icon class="submenu_open" id="arrow_right" size={1.4} style="fill: var(--text);" />
                {/if}
            </Button>
        </CombinedInput>

        {#if openedMenus.includes(i)}
            <CombinedInput textWidth={40}>
                <p><T id="inputs.url" /></p>
                <TextInput value={rss.url} on:change={(e) => setValue(e, i, "url")} />
            </CombinedInput>

            <CombinedInput textWidth={40}>
                <p><T id="meta.text_divider" /></p>
                <TextInput value={rss.divider || " | "} on:change={(e) => setValue(e, i, "divider")} />
            </CombinedInput>

            <CombinedInput textWidth={40}>
                <p><T id="edit.count" /></p>
                <NumberInput value={rss.count || 5} min={1} on:change={(e) => setValue(e, i, "count")} />
            </CombinedInput>

            <CombinedInput textWidth={40}>
                <p><T id="edit.interval" /></p>
                <Dropdown options={updateIntervalList} value={updateIntervalList.find((a) => a.id === (rss.updateInterval || "60"))?.name || ""} on:click={(e) => setValue(e, i, "updateInterval")} />
            </CombinedInput>
        {/if}
    {/each}
    <CombinedInput>
        <Button style="width: 100%;" on:click={addRSS} center dark>
            <Icon id="add" right />
            <T id="settings.add" />
        </Button>
    </CombinedInput>
</div>

<style>
    p.faded {
        font-style: italic;
        opacity: 0.7;
    }
</style>
