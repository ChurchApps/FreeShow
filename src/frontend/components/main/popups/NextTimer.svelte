<script lang="ts">
    import { onMount } from "svelte"
    import { popupData } from "../../../stores"
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
    let indexes = $popupData.indexes || layoutRef.map((_, i) => i)
    let allSlides: boolean = !$popupData.indexes?.length

    onMount(() => {
        popupData.set({})

        if (allSlides) getTotalTime()
    })

    function updateValue(e: any) {
        value = e?.detail ?? e
        if (value) value = Number(value)

        history({ id: "SHOW_LAYOUT", newData: { key: "nextTimer", data: value, indexes }, location: { page: "show", override: "change_style_slide" } })

        if (allSlides) getTotalTime()
    }

    // total time
    let totalTime: string = "0s"
    function getTotalTime() {
        let total = layoutRef.reduce((value, ref) => (value += Number(ref.data?.nextTimer || 0)), 0)

        totalTime = total ? (total > 59 ? joinTime(secondsToTime(total)) : total + "s") : "0s"
    }

    let allTime: number = 10
</script>

{#if allSlides}
    <CombinedInput>
        <NumberInput value={allTime} on:change={(e) => (allTime = Number(e.detail))} max={3600} />
    </CombinedInput>
    <CombinedInput>
        <p style="width: 100%;justify-content: center;opacity: 0.8;">
            <T id="transition.duration" />: {totalTime}
        </p>
    </CombinedInput>

    <CombinedInput style="margin-top: 10px;">
        <Button style="flex: 1;" on:click={() => updateValue(allTime)} dark center>
            <Icon id="clock" right />
            <T id="actions.to_all" />
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
        <NumberInput {value} on:change={updateValue} max={3600} />
    </CombinedInput>
{/if}
