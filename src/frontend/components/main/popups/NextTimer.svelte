<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, popupData } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { history } from "../../helpers/history"
    import { _show } from "../../helpers/shows"
    import { joinTime, secondsToTime } from "../../helpers/time"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"

    let value = $popupData.value || 0
    let layoutRef: any[] = _show().layouts("active").ref()[0]
    let allActiveSlides = layoutRef.filter((a) => !a.data.disabled)
    let indexes = $popupData.indexes || layoutRef.map((_, i) => i)
    let allSlides: boolean = !$popupData.indexes?.length

    onMount(() => {
        popupData.set({})

        if (allSlides) getTotalTime()
    })

    function updateValue(e: any) {
        value = e?.detail ?? e
        if (value) value = Number(value)

        history({ id: "SHOW_LAYOUT", newData: { key: "nextTimer", data: value, indexes }, location: { page: "show", override: "change_slide_action_timer" } })

        if (allSlides) {
            history({ id: "SHOW_LAYOUT", newData: { key: "end", data: !!value, indexes: [indexes[indexes.length - 1]] }, location: { page: "show", override: "change_slide_action_loop" } })
            activePopup.set(null)
        }
    }

    // total time
    let totalTime: number = 0
    function getTotalTime() {
        totalTime = allActiveSlides.reduce((value, ref) => (value += Number(ref.data.nextTimer || 0)), 0)
    }

    let allTime: number = allActiveSlides[0]?.data?.nextTimer || 10

    $: newTime = allTime * allActiveSlides.length

    const getTime = (time: number) => (time > 59 ? joinTime(secondsToTime(time)) : time + "s")
</script>

{#if allSlides}
    <CombinedInput>
        <NumberInput value={allTime} on:change={(e) => (allTime = Number(e.detail))} max={3600} fixed={value?.toString()?.includes(".") ? 1 : 0} decimals={1} />
    </CombinedInput>
    <CombinedInput>
        <p style="width: 100%;justify-content: center;opacity: 0.8;">
            <T id="transition.duration" />: {getTime(totalTime)}
        </p>
    </CombinedInput>

    <CombinedInput style="margin-top: 10px;">
        <Button style="flex: 1;" on:click={() => updateValue(allTime)} dark center>
            <Icon id="clock" right />
            <p style="flex: initial;min-width: auto;width: auto;padding: 0;">
                <T id="actions.to_all" />
                <span style="opacity: 0.5;min-width: auto;display: flex;align-items: center;padding-left: 6px;">
                    {#if newTime !== totalTime}({getTime(newTime)}){/if}
                </span>
            </p>
        </Button>
    </CombinedInput>

    <CombinedInput>
        <Button style="flex: 1;" on:click={() => updateValue(undefined)} center dark>
            <Icon id="reset" right />
            <T id="actions.reset" />
        </Button>
    </CombinedInput>
{:else}
    <CombinedInput>
        <NumberInput {value} on:change={updateValue} max={3600} fixed={value.toString().includes(".") ? 1 : 0} decimals={1} />
    </CombinedInput>
{/if}
