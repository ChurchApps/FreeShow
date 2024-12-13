// Examples: /show/<id>/start | /slide/next | /clear/all
const oscActions = {
    // project: {
    //     _id: (id: string) => ({
    //         open: () => ({ action: "id_select_project", id }),
    //         // open: () => ({ action: "index_select_project", index: Number(id) }),
    //     }),
    // },
    slide: {
        next: () => ({ action: "next_slide" }),
        previous: () => ({ action: "previous_slide" }),
    },
    show: {
        _id: (id: string) => ({
            // open: () => ({ action: "id_select_show", id }),
            start: () => ({ action: "start_show", id }),
            // slide: () => ({
            //     next: () => ({ action: "next_slide", id }),
            //     previous: () => ({ action: "previous_slide", id }),
            //     // _id: (slideId: string) => ({
            //     //     start: () => ({ action: "id_select_slide", id, slideId }),
            //     // }),
            // }),
        }),
    },
    clear: {
        all: () => ({ action: "clear_all" }),
        background: () => ({ action: "clear_background" }),
        slide: () => ({ action: "clear_slide" }),
        overlays: () => ({ action: "clear_overlays" }),
        audio: () => ({ action: "clear_audio" }),
        next_timer: () => ({ action: "clear_next_timer" }),
    },
    timer: {
        _id: (id: string) => ({
            start: () => ({ action: "id_start_timer", id }),
        }),
        stop: () => ({ action: "stop_timers" }),
    },
}

// data: { action: string, ... }
export function oscToAPI(data: any) {
    try {
        data = { ...data, ...parsePath(data.action) }
    } catch (err) {
        // use path value as api action id
        let action = data.action.slice(1)
        if (!action.includes("/")) return { ...data, action }

        console.log(err)
        return data
    }

    console.log("OSC API DATA:", data)
    return data
}

function parsePath(path) {
    const parts = path.split("/").filter(Boolean)
    console.log("OSC API PATH:", path)

    let currentPath: any = oscActions

    for (let part of parts) {
        if (typeof currentPath[part] === "function") {
            currentPath = currentPath[part]()
        } else if (currentPath[part]) {
            currentPath = currentPath[part]
        } else if (currentPath._id) {
            currentPath = currentPath._id(part)
        } else {
            throw new Error(`Invalid OSC API path: ${path}`)
        }
    }

    if (typeof currentPath !== "object") return {}

    return currentPath
}
