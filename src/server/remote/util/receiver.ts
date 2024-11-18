import { setError, translate } from "./helpers"
import { _, _get, _set, _update } from "./stores"

export type ReceiverKey = keyof typeof receiver
export const receiver = {
    PASSWORD: (data: any) => {
        if (data.dictionary) _set("dictionary", data.dictionary)
        let password: boolean = data.password
        _update("password", "required", password)
    },
    ERROR: (data: any) => {
        if (data === "wrongPass") {
            setError(translate("remote.wrong_password"))
            localStorage.removeItem("password")
            _update("password", "required", true)
        } else setError(data)
    },
    LANGUAGE: (data: any) => {
        _.dictionary.update((a) => {
            Object.keys(a).forEach((i) => {
                Object.keys(a[i] || {}).forEach((j) => {
                    if (data.strings[i]?.[j] && a[i]) a[i]![j] = data.strings[i][j]
                })
            })
            return a
        })
    },
    ACCESS: () => {
        if (_get("password").remember && _get("password").stored.length) localStorage.password = _get("password").stored
        _set("isConnected", true)
    },

    /////

    SHOWS: (data: any) => {
        const shows = Object.keys(data).map((id) => ({ id, ...data[id] }))
        _set("shows", shows)
        if (_get("quickPlay")) _set("activeTab", "shows")
    },
    // "SHOWS_CACHE": (data: any) => {
    //   showsCache = data
    //   },
    SHOW: (data: any) => {
        if (!_get("isConnected")) return

        if (!_get("activeShow") && !_get("quickPlay")) _set("activeTab", "show")
        // if (activeTab === "shows" || activeTab === "project" || activeTab === "projects") activeTab = "show"
        // shows[data.id] = data
        // activeShow = data.id

        _set("activeShow", data)
    },
    OUT: (data: any) => {
        if (!_get("isConnected")) return

        // clear
        if (data.slide === undefined) return

        _set("outSlide", data.slide)
        if (data.layout) _set("outLayout", data.layout)
        if (data.styleRes) _set("styleRes", data.styleRes)
        if (_get("outSlide") === null) _set("outShow", null)
        else if (data.show) {
            _set("outShow", data.show)
            if (!_get("activeShow")) _set("activeTab", "slide")
            if (!_get("activeShow")) _set("activeShow", _get("outShow"))
        } else if (_get("outShow") === null && _get("activeShow")) {
            _set("outShow", _get("activeShow"))
        }
    },
    FOLDERS: (data: any) => {
        if (!_get("isConnected")) return

        _set("folders", data.folders)
        if (!_get("openedFolders").length) _set("openedFolders", data.opened)
        // console.log(folders)
    },
    PROJECTS: (data: any) => {
        if (!_get("isConnected")) return

        _set("projects", data)
        // newest first
        _set(
            "projects",
            _get("projects").sort((a, b) => b.created - a.created)
        )

        const project = data.find((a: any) => a.id === _get("project"))
        if (project) _set("activeProject", project)
    },
    PROJECT: (data: any) => {
        if (!_get("project") && data && _get("isConnected")) {
            _set("project", data)

            const project = _get("projects").find((a: any) => a.id === data)
            if (project) _set("activeProject", project)

            if (!_get("activeShow") && !_get("quickPlay")) _set("activeTab", "project")
        }
    },
}
