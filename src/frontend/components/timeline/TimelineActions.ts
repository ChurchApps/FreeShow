import { get, Unsubscriber } from "svelte/store"
import { uid } from "uid"
import type { TimelineAction } from "../../../types/Show"
import { activeProject, activeShow, projects, selected, shows, showsCache } from "../../stores"
import { waitUntilValueIsDefined } from "../../utils/common"
import { clone } from "../helpers/array"
import { _show } from "../helpers/shows"
import { getExtension, getMediaType } from "../helpers/media"
import { getLayoutRef } from "../helpers/show"
import { AudioPlayer } from "../../audio/audioPlayer"
import { timelineSections } from "./timeline"
import { loadShows } from "../helpers/setShow"

export type TimelineType = "slide" | "show" | "project"
export class TimelineActions {
    private type: TimelineType
    private ref: { id: string; layoutId?: string } | null = null
    private actions: TimelineAction[] = []
    private unsubscriber: Unsubscriber | null = null
    private callback: (s: TimelineAction[]) => void

    constructor(type: TimelineType, actionUpdateCallback: (s: TimelineAction[]) => void) {
        this.type = type
        this.callback = actionUpdateCallback

        if (type === "show") {
            this.unsubscriber = activeShow.subscribe((a) => {
                if (!a) return

                const type = a.type || "show"
                const id = a.id
                if (type !== "show" || !id) return

                this.updateRef()
            })
        } else if (type === "project") {
            this.unsubscriber = activeProject.subscribe((id) => {
                if (!id) return

                this.updateRef()
            })
        } else {
            this.updateRef()
        }
    }

    private async updateRef() {
        this.saveState()

        if (this.type === "show") {
            const showId = get(activeShow)?.id || ""
            let currentShow = get(showsCache)[showId]
            if (!currentShow) {
                // allow show to load
                await waitUntilValueIsDefined(() => get(showsCache)[showId])
                currentShow = get(showsCache)[showId]
                if (!currentShow) return
            }

            this.ref = { id: showId, layoutId: currentShow.settings?.activeLayout || "" }
        } else if (this.type === "project") {
            const projectId = get(activeProject) || ""
            this.ref = { id: projectId }
        }

        this.loadActions()
        this.onUpdateCallbacks.forEach((cb) => cb())
    }

    onUpdateCallbacks: (() => void)[] = []
    onUpdate(callback: () => void) {
        this.onUpdateCallbacks.push(callback)
    }

    close() {
        if (!this) return
        if (this.unsubscriber) this.unsubscriber()
        this.saveState()
    }

    private hasChanged = false
    private setChanged() {
        this.hasChanged = true
        this.callback(this.actions)
    }
    private saveState() {
        if (!this.hasChanged) return
        this.hasChanged = false
        if (!this.ref || !this.actions) return

        if (this.type === "show") {
            const showId = this.ref.id
            const layoutId = this.ref.layoutId || ""

            showsCache.update((a) => {
                if (!a[showId]?.layouts?.[layoutId]) return a

                if (!a[showId].layouts[layoutId].timeline) a[showId].layouts[layoutId].timeline = { actions: [] }
                a[showId].layouts[layoutId].timeline!.actions = clone(this.actions)

                return a
            })
        } else if (this.type === "project") {
            const projectId = this.ref.id

            projects.update((a) => {
                if (!a[projectId]) return a

                if (!a[projectId].timeline) a[projectId].timeline = { actions: [] }
                a[projectId].timeline.actions = clone(this.actions)

                return a
            })
        }
    }

    // ACTIONS

    private loadActions() {
        if (!this.ref) return

        if (this.type === "show") {
            this.actions = clone(_show(this.ref.id).layouts([this.ref.layoutId]).get()[0]?.timeline?.actions || [])
        } else if (this.type === "project") {
            this.actions = clone(get(projects)[this.ref.id]?.timeline?.actions || [])
        }

        this.callback(this.actions)
    }

    private getActionIndex(actionId: string) {
        return this.actions.findIndex((a) => a.id === actionId)
    }

    getAction(actionId: string) {
        return this.actions.find((a) => a.id === actionId) || null
    }

    getActions() {
        return this.actions
    }

    addAction(action: TimelineAction) {
        this.actions.push(action)
        this.setChanged()
    }

    deleteActions(actionIds: string[]) {
        actionIds.forEach((id) => {
            const actionIndex = this.getActionIndex(id)
            if (actionIndex !== -1) this.actions.splice(actionIndex, 1)
        })
        this.setChanged()
    }

    updateTimes(dragInitialTimes: Map<string, number>, delta: number) {
        this.actions = this.actions.map((a) => {
            if (!dragInitialTimes.has(a.id)) return a
            return { ...a, time: dragInitialTimes.get(a.id)! + delta }
        })
        this.setChanged()
    }

    updateAction(actionId: string, newData: Partial<TimelineAction>) {
        const actionIndex = this.getActionIndex(actionId)
        if (actionIndex === -1) return

        this.actions[actionIndex] = { ...this.actions[actionIndex], ...newData }
        this.setChanged()
    }

    duplicateActions(actionIds: string[]) {
        const newActions: TimelineAction[] = []
        actionIds.forEach((id) => {
            const action = this.getAction(id)
            if (!action) return

            newActions.push({ ...clone(action), id: uid(6) })
        })

        this.actions.push(...newActions)
        this.setChanged()

        return newActions.map((a) => a.id)
    }

    // DROP

    handleDrop(e: DragEvent, dropTime: number) {
        const existingAudioActions = this.actions.some((a) => a.type === "audio")

        let selection = get(selected)

        // external files
        const files = e.dataTransfer?.files
        if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i]

                let audioFiles: { path: string; name: string }[] = []
                if (file.type.startsWith("audio/") || getMediaType(getExtension(file.name)) === "audio") {
                    const path = window.api.showFilePath(file)
                    audioFiles.push({ path, name: file.name })
                }

                selection = { id: "audio", data: audioFiles }
            }
        }

        let id = selection.id
        if (id === "show_drawer") id = "show"

        const supportedTypes = Object.keys(timelineSections[this.type] || {})
        if (!id || !selection.data?.length || !supportedTypes.includes(id)) return

        const layoutRef = getLayoutRef()

        selection.data.forEach(async (item) => {
            const time = id === "audio" && !existingAudioActions ? 0 : dropTime
            const type = id
            const data = await getData()
            const name = getName() || id

            if (data === null) return

            const action: TimelineAction = { id: uid(6), time, type, data, name }
            if (id === "audio") action.duration = await AudioPlayer.getDuration(item.path)

            this.addAction(action)

            async function getData() {
                if (id === "action") return { triggers: item.triggers || [], actionValues: item.actionValues || {} }
                if (id === "slide") return { id: layoutRef[item.index]?.id, index: item.index }
                if (id === "show") {
                    let show = get(showsCache)[item.id]
                    if (!show) {
                        await loadShows([item.id])
                        show = get(showsCache)[item.id]
                    }
                    if (!show) return null

                    return { id: item.id, layoutId: show.settings?.activeLayout || "" }
                }

                return item
            }

            function getName() {
                if (id === "slide") {
                    const slideId = layoutRef[item.index]?.id
                    const groupSlideId = layoutRef[item.index]?.parent?.id || slideId
                    const slideGroup = get(showsCache)[item?.showId]?.slides?.[groupSlideId]?.group
                    return slideGroup || ""
                }

                if (id === "show") {
                    return get(shows)[item.id]?.name || ""
                }

                return item.name || ""
            }
        })
    }
}
