import { get } from "svelte/store"
import { uid } from "uid"
import { MAIN } from "../../types/Channels"
import { ShowObj } from "../classes/Show"
import { clone } from "../components/helpers/array"
import { history } from "../components/helpers/history"
import { checkName, formatToFileName, getLabelId } from "../components/helpers/show"
import { activeProject, activeRename, dataPath, projectView, projects, refreshSlideThumbnails, videoExtensions } from "../stores"
import { newToast } from "../utils/common"
import { destroy, receive, send } from "../utils/request"
import { createCategory, setTempShows } from "./importHelpers"
import { getExtension } from "../components/helpers/media"

type File = {
    name: string
    url: string
    seconds?: number
    loopVideo?: boolean
}

// Open Lesson Playlist (just media)
type OlpLesson = {
    messages: {
        files: File[]
        name: string
    }[]
    lessonDescription: string
    lessonImage: string
    lessonName: string
    lessonTitle: string
    venueName?: string
}

// Open Lesson Format (full data)
type OlfLesson = {
    sections: {
        actions: {
            files: File[]
            actionType: string
            content: string
        }[]
        name: string
    }[]
    lessonDescription: string
    lessonImage: string
    lessonName: string
    studyName: string
    programAbout: string
}

export async function convertLessonsPresentation(data: any) {
    if (!data?.length) return

    let lesson: any = null
    let replacer: any = {}

    try {
        // WIP this only converts one file at a time
        lesson = JSON.parse(data[0].content)
    } catch (err) {
        console.error("Error importing Lessons.church lesson:", err)
    }

    if (!lesson) return

    newToast("$popup.importing")
    createCategory("Lessons", "book")
    createProject()

    if (lesson.sections) lesson = convertOlfLessonToOlpType(lesson)
    let { mediaToDownload, lessonShow } = convertOpenLessonPlaylist(lesson)

    // download videos/images
    send(MAIN, ["DOWNLOAD_MEDIA"], [{ path: get(dataPath), name: lesson.lessonName, files: mediaToDownload, showId: lessonShow.id }])

    let replace: any = await receiveMessage()
    replace.forEach((r) => {
        replacer[r.from] = r.to
    })

    // change from remote urls to local paths
    Object.keys(lessonShow.show.media).forEach((id) => {
        lessonShow.show.media[id].path = replacer[lessonShow.show.media[id].path]
    })

    // WIP wait to open until files actually downloaded

    // will automatically get added to the "lessons" project if just 1 show sent to tempShows
    setTempShows([lessonShow])

    // refresh thumbnails
    setTimeout(() => {
        refreshSlideThumbnails.set(true)
    }, 8000)
}

function createProject() {
    if (get(projects).lessons) {
        activeProject.set("lessons")
        return
    }

    let project = { parent: "/", created: Date.now(), name: "Lessons.church", shows: [] }
    history({ id: "UPDATE", newData: { data: project }, oldData: { id: "lessons" }, location: { id: "project", page: "show" } })

    setTimeout(() => {
        activeRename.set(null)
        projectView.set(false)
    }, 50)
}

function convertOpenLessonPlaylist(lesson: OlpLesson) {
    let slideGroups = [{ files: [{ name: "Lesson Image", url: lesson.lessonImage }], name: "Lesson Image" }, ...lesson.messages]

    // fix file names (might have spaces or :)
    slideGroups.forEach((group, i) => {
        slideGroups[i].files = group.files?.map((file) => {
            file.name = formatToFileName(file.name)
            return file
        })
    })

    let { slides, layout, media }: any = convertToSlides(slideGroups)
    let lessonShow = createShow()

    let mediaToDownload: any[] = slideGroups.map((a) => a.files).flat()

    return { mediaToDownload, lessonShow }

    function createShow() {
        let layoutId = uid()
        let show = new ShowObj(false, "lessons", layoutId)
        let showId = getLabelId(lesson.lessonTitle, false) || uid()

        let name = lesson.lessonTitle
        if (lesson.lessonName !== name) name = `${name} - ${lesson.lessonName}`
        show.name = checkName(name, showId)
        let studyName = (lesson as any).studyName || ""
        let about = (lesson as any).programAbout || ""
        show.reference = { type: "lessons", data: { about, studyName } }

        show.slides = slides
        show.media = media

        show.layouts[layoutId].slides = layout
        show.layouts[layoutId].notes = lesson.lessonDescription

        show.meta = {
            title: lesson.lessonTitle,
            name: lesson.lessonName,
            venue: lesson.venueName,
        }

        return { id: showId, show }
    }
}

function convertOlfLessonToOlpType(lesson: OlfLesson) {
    let newLesson: OlpLesson = clone({
        ...lesson,
        lessonTitle: lesson.lessonName,
        messages: getMessages(lesson.sections),
    })

    return newLesson

    function getMessages(sections: any[]) {
        let messages: any[] = []

        sections.forEach((section) => {
            let actions = section.actions?.filter((a) => a.actionType === "play")
            actions = actions.map(({ files, content }) => ({ files, name: content }))
            messages.push(...actions)
        })

        return messages
    }
}

async function receiveMessage() {
    return new Promise((resolve, reject) => {
        let listenerId = uid()

        // 5 seconds
        setTimeout(() => {
            removeListener()
            reject("Timed out!")
        }, 5000)

        receive(
            MAIN,
            {
                REPLACE_MEDIA_PATHS: (msg) => {
                    removeListener()
                    resolve(msg)
                },
            },
            listenerId
        )

        function removeListener() {
            destroy(MAIN, listenerId)
        }
    })
}

function convertToSlides(groups) {
    let slides: any = {}
    let layout: any[] = []
    let media: any = {}

    groups.forEach((group, groupIndex: number) => {
        if (!group.files?.length) return

        let children: string[] = []
        let layoutData: any = {}
        let parentId: string = ""

        group.files.forEach((file, fileIndex: number) => {
            if (!file.url) return

            let loop = !!(file.loopVideo || file.loop || file.name.includes("Title"))
            let mediaId = uid()
            // find existing
            let existingId = Object.keys(media).find((id) => media[id].path === file.url)
            if (existingId) mediaId = existingId
            else media[mediaId] = { name: file.name, path: file.url, muted: false, loop }

            let extension = getExtension(file.url)
            if (extension.includes("/") || extension.includes("\\")) extension = ""
            if (!extension && file.fileType) extension = file.fileType.slice(file.fileType.indexOf("/") + 1)
            if (!extension && file.streamUrl) extension = "mp4"
            let nextAfterMedia = !loop && get(videoExtensions).includes(extension)
            if (groupIndex >= groups.length - 1 && fileIndex >= group.files.length - 1) nextAfterMedia = false

            let slideId = uid()
            slides[slideId] = {
                group: parentId ? null : file.name,
                color: "",
                settings: {},
                notes: "",
                items: [],
            }

            let currentLayoutData: any = { background: mediaId }
            if (nextAfterMedia) currentLayoutData.actions = { nextAfterMedia: true }
            layoutData[slideId] = currentLayoutData

            if (parentId) children.push(slideId)
            else parentId = slideId
        })

        if (!parentId) return

        slides[parentId].children = children

        let parentData = clone(layoutData[parentId])
        delete layoutData[parentId]
        let currentLayout: any = { id: parentId, ...parentData, children: layoutData }

        layout.push(currentLayout)
    })

    return { slides, layout, media }
}
