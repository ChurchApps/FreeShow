<script lang="ts">
    import { get } from "svelte/store"
    import { OUTPUT } from "../../../../types/Channels"
    import type { TransitionType } from "../../../../types/Show"
    import { activeShow, selected, showsCache, transitionData } from "../../../stores"
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

        if (isSlide) {
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
            let override = "show#" + $activeShow?.id + "layout#" + _show().get("settings.activeLayout") + "index#" + $selected.data[0].index + type
            history({ id: "SHOW_LAYOUT", newData: { key: type, data: value, indexes: [$selected.data[0].index] }, location: { page: "show", override } })

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

    let isSlide: boolean = $selected.id === "slide"
    $: slideTextTransition = isSlide && $selected.data[0] ? clone($selected.data[0].transition || $transitionData.text || { type: "fade", duration: 500, easing: "sine" }) : null
    $: slideMediaTransition = isSlide && $selected.data[0] ? clone($selected.data[0].mediaTransition || $transitionData.media || { type: "fade", duration: 800, easing: "sine" }) : null

    let selectedType: "text" | "media" = "text"
    $: textIsDisabled = (isSlide ? slideTextTransition.type : $transitionData.text.type) === "none"
    $: mediaIsDisabled = (isSlide ? slideMediaTransition.type : $transitionData.media.type) === "none"
    $: textDurationValue = isSlide ? slideTextTransition.duration : $transitionData.text.duration
    $: mediaDurationValue = isSlide ? slideMediaTransition.duration : $transitionData.media.duration
    $: textEasingValue = easings.find((a) => a.id === (isSlide ? slideTextTransition.easing : $transitionData.text.easing))?.name || "$:easings.sine:$"
    $: mediaEasingValue = easings.find((a) => a.id === (isSlide ? slideMediaTransition.easing : $transitionData.media.easing))?.name || "$:easings.sine:$"
    $: textTypeValue = types.find((a) => a.id === (isSlide ? slideTextTransition.type : $transitionData.text.type))?.name || "$:transition.fade:$"
    $: mediaTypeValue = types.find((a) => a.id === (isSlide ? slideMediaTransition.type : $transitionData.media.type))?.name || "$:transition.fade:$"

    function reset() {
        let defaultDuration = selectedType === "text" ? 500 : 800
        changeTransition(selectedType, "duration", isSlide ? $transitionData[selectedType].duration || defaultDuration : defaultDuration)
        changeTransition(selectedType, "type", isSlide ? $transitionData[selectedType].type || "fade" : "fade")
        changeTransition(selectedType, "easing", isSlide ? $transitionData[selectedType].easing || "sine" : "sine")
    }
</script>

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
