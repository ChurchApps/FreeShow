import { https } from "follow-redirects"
import fs from "fs"
import path from "path"
import { doesPathExist, getDocumentsFolder } from "./files"
import { toApp } from ".."
import { MAIN } from "../../types/Channels"

export function downloadMedia(lessons: any[]) {
    let replace = lessons.map(checkLesson)

    // https://content.lessons.church/files/lesson/mC7D-ZjSswf/mwuOnLtOdyn/tfs-elem-l4-big-point-slide.jpg?dt=1647786691771
    // https://player.vimeo.com/progressive_redirect/playback/833667746/rendition/720p/file.mp4?loc=external&oauth2_token_id=1653686869&signature=2ca55a317970894a3df5801ceca48f5f613881dbcf3a2914f8d61c4d9796cfdd

    toApp(MAIN, { channel: "REPLACE_MEDIA_PATHS", data: replace.flat() })
}

function checkLesson(lesson: any) {
    // check url
    return lesson.files.map((file: any) => downloadFile(lesson.name, file))
}

function downloadFile(lessonName: string, file: any) {
    let extension = "mp4"
    // if (file.url.includes(".mp4")) extension = "mp4"
    if (file.url.includes(".jpg")) extension = "jpg"
    if (file.url.includes(".png")) extension = "png"

    let fileName = file.name
    if (!fileName.includes("." + extension)) fileName += "." + extension
    const rootPath = getDocumentsFolder(null, "Lessons")
    const localPath = path.join(rootPath, lessonName, fileName)

    if (doesPathExist(localPath)) {
        console.log(localPath + " exists!")
        return { from: file.url, to: localPath }
    }

    // download the media
    const fileStream = fs.createWriteStream(localPath)
    https.get(file.url, (res) => {
        res.pipe(fileStream)

        res.on("error", (err) => {
            console.log(err)
        })

        fileStream.on("error", (err) => {
            console.log(err)
        })

        fileStream.on("finish", () => {
            fileStream.close()
            console.log("Media: '" + file.name + "', downloaded!")
        })
    })

    return { from: file.url, to: localPath }
}
