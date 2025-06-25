<script lang="ts">
    import { onMount } from "svelte"
    import type { LayoutRef } from "../../../../types/Show"
    import { activePopup, activeProject, activeShow, popupData, projects, showsCache } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { history } from "../../helpers/history"
    import { _show } from "../../helpers/shows"
    import { joinTime, secondsToTime } from "../../helpers/time"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import { getLayoutRef } from "../../helpers/show"

    let type = $popupData.type || "show"

    let value = $popupData.value || 0
    let layoutRef = getLayoutRef()
    let allActiveSlides = layoutRef.filter((a) => !a.data.disabled)
    let indexes = $popupData.indexes || layoutRef.map((_, i) => i)
    let allSlides = !$popupData.indexes?.length

    onMount(() => {
        popupData.set({})

        if (type === "folder") totalTime = $popupData.totalTime
        else if (allSlides) getTotalTime()
    })

    function updateValue(e: any) {
        value = e?.detail ?? e
        if (value) value = Number(value)

        if (type === "folder") {
            projects.update((a) => {
                const index = $activeShow?.index ?? -1
                const projectId = $activeProject
                if (!projectId || !a[projectId] || index < 0) return a

                if (!a[projectId].shows[index].data) a[projectId].shows[index].data = {}
                a[projectId].shows[index].data.timer = value || 0

                return a
            })

            activePopup.set(null)
            return
        }

        history({ id: "SHOW_LAYOUT", newData: { key: "nextTimer", data: value, indexes }, location: { page: "show", override: "change_slide_action_timer" } })

        if (allSlides) {
            // remove existing go to start if just one applied to any slide
            let goToStartRefs = allActiveSlides.reduce((value, ref) => (ref.data?.end ? [...value, ref] : value), [] as LayoutRef[])
            if (goToStartRefs.length === 1) {
                let showId = $activeShow?.id || ""
                let layoutId = _show().get("settings.activeLayout")
                showsCache.update((a) => {
                    let ref = goToStartRefs[0]
                    if (ref.type === "parent") delete a[showId].layouts[layoutId]?.slides?.[ref.index]?.end
                    else delete a[showId].layouts[layoutId]?.slides?.[ref.parent?.index ?? -1]?.children?.[ref.id]?.end
                    return a
                })
            }

            history({ id: "SHOW_LAYOUT", newData: { key: "end", data: !!value, indexes: [indexes[indexes.length - 1]] }, location: { page: "show", override: "change_slide_action_loop" } })
            activePopup.set(null)
        }
    }

    // total time
    let appliedToSlides = 0
    let totalTime = 0
    function getTotalTime() {
        totalTime = allActiveSlides.reduce((value, ref) => (value += Number(ref.data.nextTimer || 0)), 0)

        let allValues = allActiveSlides.map((ref) => Number(ref.data.nextTimer || 0))
        appliedToSlides = [...new Set(allValues)].length === 1 && allValues[0] === allTime ? allTime : 0
    }

    let allTime: number = type === "folder" ? value || 10 : allActiveSlides[0]?.data?.nextTimer || 10

    $: newTime = allTime * allActiveSlides.length

    const getTime = (time: number) => (time > 59 ? joinTime(secondsToTime(time)) : time + "s")
</script>

{#if allSlides}
    {#if totalTime}
        <p style="text-align: center;opacity: 0.7;font-size: 0.9em;margin-bottom: 10px;">
            <T id="transition.duration" />: {getTime(totalTime)}
        </p>
    {/if}

    <CombinedInput>
        <NumberInput value={allTime} on:change={(e) => (allTime = Number(e.detail))} max={3600} fixed={value?.toString()?.includes(".") ? 1 : 0} decimals={1} />
    </CombinedInput>

    <CombinedInput>
        <!-- reset if next timer applied, but not same on all slides ?? (set input to 0) -->
        {#if type === "folder" ? !allTime || allTime === value : totalTime && (appliedToSlides === allTime || allTime === 0)}
            <Button style="flex: 1;" on:click={() => updateValue(undefined)} center dark>
                <Icon id="reset" right />
                <T id="actions.reset" />
            </Button>
        {:else}
            <Button style="flex: 1;" disabled={allTime === 0} on:click={() => updateValue(allTime)} dark center>
                <Icon id="clock" right />
                <p style="flex: initial;min-width: auto;width: auto;padding: 0;">
                    <T id="actions.to_all" />

                    <span style="opacity: 0.5;font-size: 0.9em;min-width: auto;display: flex;align-items: center;padding-inline-start: 6px;">
                        {#if newTime}({getTime(newTime)}){/if}
                    </span>
                </p>
            </Button>
        {/if}
    </CombinedInput>
{:else}
    <CombinedInput>
        <NumberInput {value} on:change={updateValue} max={3600} fixed={value.toString().includes(".") ? 1 : 0} decimals={1} />
    </CombinedInput>
{/if}
