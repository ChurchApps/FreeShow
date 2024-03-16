import { get } from "svelte/store"
import { keysToID } from "../components/helpers/array"
import { getActiveOutputs, setOutput } from "../components/helpers/output"
import { playNextGroup, updateOut } from "../components/helpers/showActions"
import { _show } from "../components/helpers/shows"
import { activeProject, activeShow, dictionary, groups, outLocked, outputs, projects } from "../stores"
import { newToast } from "./messages"

// WIP duplicate of Preview.svelte checkGroupShortcuts()
export function gotoGroup(dataGroupId: string) {
    let outputId = getActiveOutputs(get(outputs))[0]
    let currentOutput: any = outputId ? get(outputs)[outputId] || {} : {}
    let outSlide = currentOutput.out?.slide
    let currentShowId = outSlide?.id || (get(activeShow) !== null ? (get(activeShow)!.type === undefined || get(activeShow)!.type === "show" ? get(activeShow)!.id : null) : null)
    if (!currentShowId) return

    let showRef = _show(currentShowId).layouts("active").ref()[0] || []
    let groupIds = showRef.map((a) => a.id)
    let showGroups = groupIds.length ? _show(currentShowId).slides(groupIds).get() : []
    if (!showGroups.length) return

    let globalGroupIds: string[] = []
    Object.keys(get(groups)).forEach((groupId: string) => {
        if (groupId !== dataGroupId) return

        showGroups.forEach((slide) => {
            if (slide.globalGroup === groupId) globalGroupIds.push(slide.id)
        })
    })

    playNextGroup(globalGroupIds, { showRef, outSlide, currentShowId })
}

export function selectProjectByIndex(index: number) {
    if (index < 0) return

    // select project
    let selectedProject = keysToID(get(projects)).sort((a, b) => a.name.localeCompare(b.name))[index]
    if (!selectedProject) {
        newToast(get(dictionary).toast?.midi_no_project + " " + index)
        return
    }

    activeProject.set(selectedProject.id)
}

export function selectSlideByIndex(index: number) {
    let showRef = _show().layouts("active").ref()[0]
    if (!showRef) {
        newToast("$toast.midi_no_show")
        return
    }

    let slideRef = showRef[index]
    if (!slideRef) {
        newToast(get(dictionary).toast?.midi_no_slide + " " + index)
        return
    }

    // WIP duplicate of Slides.svelte:57 (slideClick)
    if (get(outLocked)) return

    updateOut("active", index, showRef)
    let showId = get(activeShow)!.id
    let activeLayout = _show().get("settings.activeLayout")
    setOutput("slide", { id: showId, layout: activeLayout, index: index, line: 0 })
}
