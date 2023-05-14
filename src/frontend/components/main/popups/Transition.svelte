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

    const types: TransitionType[] = ["none", "fade", "blur", "scale", "spin", "slide"]

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
</script>

<main>
    <div>
        <p>
            <Icon id="text" size={1.2} />
            <T id="transition.text" />{#if isSlide}&nbsp;<T id="transition.current_slide" />{/if}
        </p>
        <NumberInput
            disabled={(isSlide ? slideTextTransition.type : $transitionData.text.type) === "none"}
            value={isSlide ? slideTextTransition.duration : $transitionData.text.duration}
            max={20000}
            fixed={1}
            decimals={3}
            step={100}
            inputMultiplier={0.001}
            on:change={(e) => changeTransition("text", "duration", e.detail)}
        />
        <Dropdown
            disabled={(isSlide ? slideTextTransition.type : $transitionData.text.type) === "none"}
            options={easings}
            value={easings.find((a) => a.id === (isSlide ? slideTextTransition.easing : $transitionData.text.easing))?.name || "$:easings.sine:$"}
            on:click={(e) => changeTransition("text", "easing", e.detail.id)}
        />
        {#each types as type}
            <Button on:click={() => changeTransition("text", "type", type)} active={(isSlide ? slideTextTransition.type : $transitionData.text.type) === type} style="width: 100%;justify-content: left;" center>
                <!-- icons -->
                <Icon id={""} size={1.2} right />
                <T id="transition.{type}" />
            </Button>
        {/each}
    </div>

    <!-- {#if !slideTransition} -->
    <div>
        <p>
            <Icon id="image" size={1.2} />
            <T id="transition.media" />{#if isSlide}&nbsp;<T id="transition.current_slide" />{/if}
        </p>
        <NumberInput
            disabled={(isSlide ? slideMediaTransition.type : $transitionData.media.type) === "none"}
            value={isSlide ? slideMediaTransition.duration : $transitionData.media.duration}
            max={20000}
            fixed={1}
            decimals={3}
            step={100}
            inputMultiplier={0.001}
            on:change={(e) => changeTransition("media", "duration", e.detail)}
        />
        <Dropdown
            disabled={(isSlide ? slideMediaTransition.type : $transitionData.media.type) === "none"}
            options={easings}
            value={easings.find((a) => a.id === (isSlide ? slideMediaTransition.easing : $transitionData.media.easing))?.name || "$:easings.linear:$"}
            on:click={(e) => changeTransition("media", "easing", e.detail.id)}
        />
        {#each types as type}
            <Button on:click={() => changeTransition("media", "type", type)} active={(isSlide ? slideMediaTransition.type : $transitionData.media.type) === type} style="width: 100%;justify-content: left;" center>
                <!-- icons -->
                <Icon id={""} size={1.2} right />
                <T id="transition.{type}" />
            </Button>
        {/each}
    </div>
    <!-- {/if} -->
</main>

<hr />
<Button
    on:click={() => {
        changeTransition("text", "duration", $transitionData.text.duration || 500)
        changeTransition("text", "type", $transitionData.text.type || "fade")
        changeTransition("text", "easing", $transitionData.text.easing || "sine")
        changeTransition("media", "duration", $transitionData.media.duration || 800)
        changeTransition("media", "type", $transitionData.media.type || "fade")
        changeTransition("media", "easing", $transitionData.media.easing || "sine")
    }}
    center
>
    <Icon id="reset" size={1.2} right />
    <T id="actions.reset" />
</Button>

<style>
    main {
        display: flex;
        gap: 20px;
    }

    div {
        display: flex;
        flex-direction: column;
        width: 100%;
    }

    p {
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        gap: 10px;
        margin-bottom: 10px;
    }

    hr {
        height: 3px;
        background-color: var(--primary-lighter);
        margin: 10px 0;
        border: none;
    }
</style>
