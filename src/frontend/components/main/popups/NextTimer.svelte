<script lang="ts">
    import { onMount } from "svelte"
    import type { LayoutRef } from "../../../../types/Show"
    import { activePopup, activeProject, activeShow, popupData, projects, showsCache } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { history } from "../../helpers/history"
    import { getLayoutRef } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import { joinTime, secondsToTime } from "../../helpers/time"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"

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
        if (value) value = value

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
                    if (!ref) return a

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
    <MaterialNumberInput label="timer.seconds" value={allTime} max={3600} on:change={(e) => (allTime = e.detail)} />

    <!-- reset if next timer applied, but not same on all slides ?? (set input to 0) -->
    {#if type === "folder" ? !allTime || allTime === value : totalTime && (appliedToSlides === allTime || allTime === 0)}
        <MaterialButton variant="outlined" icon="reset" on:click={() => updateValue(undefined)}>
            <T id="actions.reset" />
        </MaterialButton>
    {:else}
        <MaterialButton variant="outlined" icon="clock" disabled={allTime === 0} info={getTime(newTime)} on:click={() => updateValue(allTime)}>
            <T id="actions.to_all" />
        </MaterialButton>
    {/if}

    {#if totalTime}
        <p style="text-align: center;opacity: 0.7;font-size: 0.9em;margin-top: 20px;">
            <T id="transition.duration" />: {getTime(totalTime)}
        </p>
    {/if}
{:else}
    <MaterialNumberInput label="timer.seconds" {value} max={3600} on:change={updateValue} />
{/if}
