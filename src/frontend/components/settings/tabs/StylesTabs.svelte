<script lang="ts">
    import { uid } from "uid"
    import type { Styles } from "../../../../types/Settings"
    import { activeStyle, activeTriggerFunction, dictionary, outputs, styles } from "../../../stores"
    import { waitForPopupData } from "../../../utils/popup"
    import Icon from "../../helpers/Icon.svelte"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Tabs from "../../input/Tabs.svelte"
    import HiddenInput from "../../inputs/HiddenInput.svelte"

    $: stylesList = sortByName(keysToID($styles))

    // set id after deletion
    $: if (Object.keys($styles)?.length && !$styles[$activeStyle]) activeStyle.set($styles.default ? "default" : Object.keys($styles)[0])

    const defaultStyle: Styles = {
        name: $dictionary.example?.default || "Default"
    }

    $: styleId = $activeStyle || ""
    $: currentStyle = $styles[styleId] || clone(defaultStyle)

    function updateStyle(e: any, key: string, currentId = "") {
        let value = e?.detail ?? e?.target?.value ?? e

        if (!currentId) currentId = styleId || "default"

        // create a style if nothing exists
        styles.update((a) => {
            if (!a[currentId]) a[currentId] = clone(currentStyle)

            return a
        })

        history({ id: "UPDATE", newData: { key, data: value }, oldData: { id: currentId }, location: { page: "settings", id: "settings_style", override: "style_" + key } })

        styleId = currentId
    }

    // CREATE

    $: if ($activeTriggerFunction === "create_style") createStyle({})
    async function createStyle(e: any) {
        const skipPopup = e.ctrlKey || e.metaKey
        let type = skipPopup ? "normal" : await waitForPopupData("choose_style")
        if (!type) return

        // create default if no styles
        if (!stylesList.length) {
            history({ id: "UPDATE", newData: { data: clone(currentStyle) }, oldData: { id: "default" }, location: { page: "settings", id: "settings_style" } })
        }
        styleId = uid()

        if (type === "live") {
            const liveStyle: Styles = {
                ...clone(defaultStyle),
                background: "#01FF70",
                transition: { text: { duration: 500, easing: "sine", type: "fade", between: { type: "none", duration: 500, easing: "sine" } } },
                fit: "blur",
                layers: ["slide", "overlays"],
                lines: 2,
                template: "lowerThird",
                templateScripture: "scriptureLT",
                templateScripture_2: "scriptureLT_2"
            }
            history({ id: "UPDATE", newData: { data: liveStyle, replace: { name: $dictionary.tabs?.live || currentStyle.name + " 2" } }, oldData: { id: styleId }, location: { page: "settings", id: "settings_style" } })
        } else if (type === "normal") {
            history({ id: "UPDATE", newData: { data: clone(defaultStyle), replace: { name: currentStyle.name + " 2" } }, oldData: { id: styleId }, location: { page: "settings", id: "settings_style" } })
        }

        activeStyle.set(styleId)
    }

    let edit: any
</script>

<Tabs id="style" tabs={stylesList} value={styleId} newLabel="new.style" class="context #style" on:open={(e) => activeStyle.set(e.detail)} on:create={createStyle} let:tab>
    {#if Object.values($outputs).find((a) => a.style === tab.id)}<Icon id="check" size={0.7} white right />{/if}
    <HiddenInput value={tab.name} id={"style_" + tab.id} on:edit={(e) => updateStyle(e.detail.value, "name", tab.id)} bind:edit />
</Tabs>
