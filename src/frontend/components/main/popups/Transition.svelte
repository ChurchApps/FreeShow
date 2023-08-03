<script lang="ts">
    import { get } from "svelte/store"
    import { OUTPUT } from "../../../../types/Channels"
    import type { TransitionType } from "../../../../types/Show"
    import { activeEdit, activeShow, overlays, popupData, selected, showsCache, templates, transitionData } from "../../../stores"
    import { easings } from "../../../utils/transitions"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import { clone } from "../../helpers/array"
    import CombinedInput from "../../inputs/CombinedInput.svelte"

    const types: { id: TransitionType; name: string }[] = [
        { id: "none", name: "$:transition.none:$" },
        { id: "fade", name: "$:transition.fade:$" },
        { id: "blur", name: "$:transition.blur:$" },
        { id: "scale", name: "$:transition.scale:$" },
        { id: "spin", name: "$:transition.spin:$" },
        { id: "slide", name: "$:transition.slide:$" },
    ]

    function changeTransition(id: "text" | "media", key: "type" | "duration" | "easing", value: any) {
        if (key === "duration") value = Number(value)

        if (isItem) {
            // WIP duplicate of SetTime.svelte ++
            let indexes = $activeEdit.items

            slideItemTransition[key] = value
            value = { ...(slideItemTransition || {}), [key]: value }

            slideItems.forEach((_: any, i: number) => {
                if (!indexes.includes(i)) return

                if (!slideItems[i].actions) slideItems[i].actions = {}
                slideItems[i].actions.transition = value
            })

            let actions = indexes.map((i) => slideItems[i].actions)

            if ($activeEdit.type === "overlay" || $activeEdit.type === "template") {
                history({
                    id: "UPDATE",
                    oldData: { id: $activeEdit.id },
                    newData: { key: "items", subkey: "actions", data: actions, indexes },
                    location: { page: "edit", id: $activeEdit.type + "_items", override: "itemaction_" + indexes.join(",") },
                })

                return
            }

            history({
                id: "setItems",
                newData: { style: { key: "actions", values: actions } },
                location: { page: "edit", show: $activeShow!, slide: slideRef.id, items: indexes, override: "itemaction_" + slideRef.id + "_items_" + indexes.join(",") },
            })
        } else if (isSlide) {
            if (id === "text") {
                slideTextTransition[key] = value
                value = { ...(slideTextTransition || {}), [key]: value }
            } else {
                slideMediaTransition[key] = value
                value = { ...(slideMediaTransition || {}), [key]: value }
            }

            let globalValues = $transitionData[id]
            if (value.type === globalValues.type && value.duration === globalValues.duration && value.easing === globalValues.easing) value = null

            let type = id === "text" ? "transition" : "mediaTransition"
            let indexes = $selected.data.map((a) => a.index)
            let override = "show#" + $activeShow?.id + "layout#" + _show().get("settings.activeLayout") + "indexes#" + indexes.join(",") + type
            history({ id: "SHOW_LAYOUT", newData: { key: type, data: value, indexes }, location: { page: "show", override } })

            setTimeout(() => {
                window.api.send(OUTPUT, { channel: "SHOWS", data: get(showsCache) })
            }, 500)
        } else {
            transitionData.update((a: any) => {
                a[id][key] = value
                return a
            })
        }
    }

    let isItem: boolean = $popupData.action === "transition"
    let isSlide: boolean = $selected.id === "slide"
    let ref = isSlide || isItem ? _show().layouts("active").ref()[0] : []

    let slideIndex = isItem ? $activeEdit.slide : $selected.data?.[0]?.index
    let slideRef = ref?.[slideIndex] || {}

    let slideItems: any[] = []
    if (isItem) {
        if ($activeEdit.type === "overlay") slideItems = $overlays[$activeEdit.id || ""]?.items || []
        else if ($activeEdit.type === "template") slideItems = $templates[$activeEdit.id || ""]?.items || []
        else slideItems = _show().get("slides")[slideRef.id]?.items || []
    }
    let firstItem = slideItems[$activeEdit.items[0]] || {}
    $: slideItemTransition = isItem ? clone(firstItem.actions?.transition || $transitionData.text || { type: "fade", duration: 500, easing: "sine" }) : {}

    let firstSlide = slideRef.data || {}
    $: slideTextTransition = isSlide ? clone(firstSlide.transition || $transitionData.text || { type: "fade", duration: 500, easing: "sine" }) : {}
    $: slideMediaTransition = isSlide ? clone(firstSlide.mediaTransition || $transitionData.media || { type: "fade", duration: 800, easing: "sine" }) : {}

    $: currentTextTransition = clone(isItem ? slideItemTransition : isSlide ? slideTextTransition : $transitionData.text)
    $: currentMediaTransition = clone(isSlide ? slideMediaTransition : $transitionData.media)

    let selectedType: "text" | "media" = "text"
    $: textIsDisabled = currentTextTransition.type === "none"
    $: mediaIsDisabled = currentMediaTransition.type === "none"
    $: textDurationValue = currentTextTransition.duration
    $: mediaDurationValue = currentMediaTransition.duration
    $: textEasingValue = easings.find((a) => a.id === currentTextTransition.easing)?.name || "$:easings.sine:$"
    $: mediaEasingValue = easings.find((a) => a.id === currentMediaTransition.easing)?.name || "$:easings.sine:$"
    $: textTypeValue = types.find((a) => a.id === currentTextTransition.type)?.name || "$:transition.fade:$"
    $: mediaTypeValue = types.find((a) => a.id === currentMediaTransition.type)?.name || "$:transition.fade:$"

    function reset() {
        let defaultDuration = selectedType === "text" ? 500 : 800
        changeTransition(selectedType, "duration", isSlide || isItem ? $transitionData[selectedType].duration || defaultDuration : defaultDuration)
        changeTransition(selectedType, "type", isSlide || isItem ? $transitionData[selectedType].type || "fade" : "fade")
        changeTransition(selectedType, "easing", isSlide || isItem ? $transitionData[selectedType].easing || "sine" : "sine")
    }
</script>

{#if !isItem}
    <div style="display: flex;">
        <Button
            on:click={() => (selectedType = "text")}
            style={selectedType === "text" ? "flex: 1;border-bottom: 2px solid var(--secondary) !important;white-space: nowrap;" : "flex: 1;border-bottom: 2px solid var(--primary-lighter);white-space: nowrap;"}
            bold={false}
            center
            dark
        >
            <Icon id="text" right />
            <T id="transition.text" />{#if isSlide}&nbsp;<T id="transition.current_slide" />{/if}
        </Button>
        <Button
            on:click={() => (selectedType = "media")}
            style={selectedType === "media" ? "flex: 1;border-bottom: 2px solid var(--secondary) !important;white-space: nowrap;" : "flex: 1;border-bottom: 2px solid var(--primary-lighter);white-space: nowrap;"}
            bold={false}
            center
            dark
        >
            <Icon id="image" right />
            <T id="transition.media" />{#if isSlide}&nbsp;<T id="transition.current_slide" />{/if}
        </Button>
    </div>
{/if}

<CombinedInput style="margin-top: 10px;">
    <p><T id="transition.duration" /></p>
    <NumberInput
        disabled={selectedType === "text" ? textIsDisabled : mediaIsDisabled}
        value={selectedType === "text" ? textDurationValue : mediaDurationValue}
        max={20000}
        fixed={1}
        decimals={3}
        step={100}
        inputMultiplier={0.001}
        on:change={(e) => changeTransition(selectedType, "duration", e.detail)}
    />
</CombinedInput>
<CombinedInput>
    <p><T id="transition.easing" /></p>
    <Dropdown disabled={selectedType === "text" ? textIsDisabled : mediaIsDisabled} options={easings} value={selectedType === "text" ? textEasingValue : mediaEasingValue} on:click={(e) => changeTransition(selectedType, "easing", e.detail.id)} />
</CombinedInput>
<CombinedInput>
    <p><T id="transition.type" /></p>
    <Dropdown options={types} value={selectedType === "text" ? textTypeValue : mediaTypeValue} on:click={(e) => changeTransition(selectedType, "type", e.detail.id)} />
</CombinedInput>

<br />

<Button on:click={reset} center dark>
    <Icon id="reset" size={1.2} right />
    <T id="actions.reset" />
</Button>
