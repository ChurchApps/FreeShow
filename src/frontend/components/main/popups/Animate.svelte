<script lang="ts">
    import { onMount } from "svelte"
    import type { Animation, AnimationAction } from "../../../../types/Output"
    import { activeAnimate, dictionary, popupData } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { addToPos } from "../../helpers/mover"
    import { _show } from "../../helpers/shows"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"

    export const easings: any[] = [
        { id: "linear", name: "$:easings.linear:$" },
        { id: "ease", name: "$:easings.ease:$" },
        { id: "ease-in", name: "$:easings.ease-in:$" },
        { id: "ease-out", name: "$:easings.ease-out:$" },
        { id: "ease-in-out", name: "$:easings.ease-in-out:$" },
    ]

    const types = [
        { id: "change", name: "$:animate.change:$" },
        // { id: "set", name: "$:animate.set:$" },
        { id: "wait", name: "$:animate.wait:$" },
    ]
    const ids = [
        { id: "text", name: "$:animate.text:$" },
        { id: "item", name: "$:animate.item:$" },
        { id: "background", name: "$:animate.background:$" },
    ]
    // const setIds = [
    //     { id: "text", name: "$:animate.text:$" },
    //     { id: "item", name: "$:animate.item:$" },
    // ]
    const backgroundKeys = [
        { id: "zoom", name: "$:actions.zoom:$" },
        // { id: "filter", name: "$:edit.filters:$" },
    ]
    const textKeys = [
        // TEXT
        { id: "font-size", data: { extension: "px" }, name: "$:edit.size:$" },

        { id: "line-height", values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, data: { extension: "em" }, name: "$:edit.line_height:$" },
        { id: "letter-spacing", values: { max: 100, min: -1000 }, data: { extension: "px" }, name: "$:edit.letter_spacing:$" },
        { id: "word-spacing", values: { min: -100 }, data: { extension: "px" }, name: "$:edit.word_spacing:$" },
    ]
    const itemKeys = [
        { id: "left", values: { min: -100000, max: 100000 }, data: { extension: "px" }, name: "$:edit.x:$" },
        { id: "top", values: { min: -100000, max: 100000 }, data: { extension: "px" }, name: "$:edit.y:$" },
        { id: "width", values: { min: -100000, max: 100000 }, data: { extension: "px" }, name: "$:edit.width:$" },
        { id: "height", values: { min: -100000, max: 100000 }, data: { extension: "px" }, name: "$:edit.height:$" },

        { id: "rotate", values: { max: 360 }, data: { extension: "deg" }, name: "$:edit.rotation:$" },
        { id: "opacity", values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 }, name: "$:edit.opacity:$" },
        { id: "border-radius", values: { step: 10, max: 500, inputMultiplier: 0.1 }, data: { extension: "px" }, name: "$:edit.corner_radius:$" },
    ]

    const DEFAULT_ANIMATION: AnimationAction = { type: "change", duration: 3, id: "text", key: "font-size", extension: "px" }

    let animation: Animation = $popupData.data || { actions: [] }

    let loaded = false
    onMount(() => {
        loaded = true
    })

    $: if (animation) updateAnimation()

    function updateAnimation() {
        if (!loaded) return

        let ref = _show().layouts("active").ref()[0]
        let actions = clone(ref[$popupData.indexes[0]]?.data?.actions) || {}

        actions.animate = animation
        if (!animation.actions.length) delete actions.animate

        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes: $popupData.indexes }, location: { page: "show", override: "animate_slide" } })
    }

    function addAnimation() {
        animation.actions.push(clone(DEFAULT_ANIMATION))
        animation.actions = animation.actions
    }

    function removeItem(index: number) {
        animation.actions.splice(index, 1)
        animation.actions = animation.actions
    }

    function duplicate(index: number) {
        let newItem = clone(animation.actions[index])
        animation.actions = addToPos(animation.actions, [newItem], index)
    }

    function moveItem(index: number, down: boolean = false) {
        let newItems = clone(animation.actions)
        let currentItem = newItems.splice(index, 1)

        let newIndex = down ? index + 1 : index - 1
        // if (newIndex < 0) newIndex = animation.actions.length - 1
        // else if (newIndex + 1 > animation.actions.length) newIndex = 0

        animation.actions = addToPos(newItems, currentItem, newIndex)
    }

    function getOption(id: string | undefined, options: any[]) {
        if (!id) return {}
        return options.find((a) => a.id === id) || {}
    }
    function getOptionName(id: string | undefined, options: any[]) {
        if (!id) return ""
        return options.find((a) => a.id === id)?.name || ""
    }

    // function updateValue(e: any, i: number) {
    //     let value = e.target.value
    //     animation.actions[i].value = value
    // }

    function changeRepeat(e: any) {
        let value = e.target.checked
        animation.repeat = value
    }

    // get active output
    $: currentActive = $popupData.indexes.includes($activeAnimate.slide)
</script>

<!-- EXAMPLES -->
<!-- (set/change/wait) -->
<!-- Change "background" (zoom/filter) to [100] in [10] seconds. -->
<!-- Change "text" (letter-spacing/font-size) from (current/custom) value [0] to [100] in [10] seconds. (repeat) -->
<!-- WAIT 10 seconds -->

<div class="list">
    {#each animation.actions as animate, i}
        <CombinedInput style={currentActive && $activeAnimate.index === i ? "outline: 2px solid var(--secondary);outline-offset: 0;z-index: 1;" : ""}>
            <Dropdown options={types} value={getOptionName(animate.type, types) || "—"} on:click={(e) => (animation.actions[i].type = e.detail.id)} />

            {#if animate.type === "wait"}
                <span><T id="animate.for" /></span>
                <NumberInput style="max-width: 80px;" value={animate.duration || 3} on:change={(e) => (animation.actions[i].duration = e.detail)} fixed={Number(animate.duration).toString().includes(".") ? 1 : 0} decimals={1} buttons={false} />
                <span style="flex: 20;"><T id="animate.seconds" /></span>
                <!-- {:else if animate.type === "set"}
                <Dropdown options={setIds} value={getOptionName(animate.id, setIds) || Object.values(setIds)[0].name} on:click={(e) => (animation.actions[i].id = e.detail.id)} />

                {#if !animate.id || animate.id === "text"}
                    <Dropdown options={textKeys} value={getOptionName(animate.key, textKeys) || Object.values(textKeys)[0].name} on:click={(e) => (animation.actions[i].key = e.detail.id)} />
                {:else if animate.id === "item"}
                    <Dropdown options={itemKeys} value={getOptionName(animate.key, itemKeys) || Object.values(itemKeys)[0].name} on:click={(e) => (animation.actions[i].key = e.detail.id)} />
                {/if}

                <span><T id="animate.to" /></span>
                <NumberInput style="flex: 20;" value={animate.value || 0} on:change={(e) => (animation.actions[i].value = e.detail)} buttons={false} /> -->
            {:else if animate.type === "change"}
                <Dropdown options={ids} value={getOptionName(animate.id, ids) || Object.values(ids)[0].name} on:click={(e) => (animation.actions[i].id = e.detail.id)} />

                {#if !animate.id || animate.id === "text"}
                    <!-- style="text-transform: lowercase;" -->
                    <Dropdown
                        options={textKeys}
                        value={getOptionName(animate.key, textKeys) || Object.values(textKeys)[0].name}
                        on:click={(e) => {
                            animation.actions[i].key = e.detail.id
                            animation.actions[i].extension = e.detail.data?.extension || ""
                        }}
                    />
                {:else if animate.id === "item"}
                    <Dropdown
                        options={itemKeys}
                        value={getOptionName(animate.key, itemKeys) || Object.values(itemKeys)[0].name}
                        on:click={(e) => {
                            animation.actions[i].key = e.detail.id
                            animation.actions[i].extension = e.detail.data?.extension || ""
                        }}
                    />
                {:else if animate.id === "background"}
                    <Dropdown options={backgroundKeys} value={getOptionName(animate.key, backgroundKeys) || Object.values(backgroundKeys)[0].name} on:click={(e) => (animation.actions[i].key = e.detail.id)} />
                {/if}

                {#if !animate.id || animate.id === "text"}
                    <span><T id="animate.to" /></span>
                    <!-- <TextInput value={animate.value || "0"} on:change={(e) => updateValue(e, i)} /> -->
                    {#key animate.key}
                        <NumberInput style="max-width: 80px;" value={animate.value || 0} {...getOption(animate.key, textKeys).values || {}} on:change={(e) => (animation.actions[i].value = e.detail || 0)} buttons={false} />
                    {/key}
                {:else if animate.id === "item"}
                    <span><T id="animate.to" /></span>
                    {#key animate.key}
                        <NumberInput style="max-width: 80px;" value={animate.value || 0} {...getOption(animate.key, itemKeys).values || {}} on:change={(e) => (animation.actions[i].value = e.detail || 0)} buttons={false} />
                    {/key}
                {/if}

                <span><T id="animate.for" /></span>
                <NumberInput style="max-width: 80px;" value={animate.duration || 3} on:change={(e) => (animation.actions[i].duration = e.detail)} fixed={Number(animate.duration).toString().includes(".") ? 1 : 0} decimals={1} buttons={false} />
                <span style="flex: 20;"><T id="animate.seconds" /></span>
            {/if}

            <span style="padding: 0;opacity: 1;">
                <Button on:click={() => moveItem(i)} disabled={i === 0}>
                    <Icon id="up" />
                </Button>
                <Button on:click={() => moveItem(i, true)} disabled={i + 1 >= animation.actions.length}>
                    <Icon id="down" />
                </Button>
                <Button title={$dictionary.actions?.duplicate} on:click={() => duplicate(i)}>
                    <Icon id="duplicate" />
                </Button>
                <Button title={$dictionary.settings?.remove} on:click={() => removeItem(i)}>
                    <Icon id="delete" />
                </Button>
            </span>
        </CombinedInput>
    {/each}
</div>

<CombinedInput>
    <Button style="width: 100%;" on:click={addAnimation} center dark>
        <Icon id="add" size={1.2} right />
        <T id="settings.add" />
    </Button>
</CombinedInput>

<br />

<CombinedInput>
    <p><T id="calendar.repeat" /></p>
    <span class="alignRight">
        <Checkbox checked={animation.repeat} disabled={!animation.actions.find((a) => a.type === "wait")} on:change={changeRepeat} />
    </span>
</CombinedInput>
<CombinedInput>
    <p><T id="transition.easing" /></p>
    <Dropdown options={easings} value={getOptionName(animation.easing || "ease", easings)} on:click={(e) => (animation.easing = e.detail.id)} />
</CombinedInput>

<!-- <br />

<Button on:click={updateAnimation} center dark>
    <Icon id="save" size={1.2} right />
    <T id="actions.save" />
</Button> -->

<style>
    .list {
        display: flex;
        flex-direction: column;
    }

    .list span {
        display: flex;
        align-items: center;

        padding: 0 10px;
        opacity: 0.7;
    }

    .list :global(.dropdown) {
        width: auto;
    }
</style>
