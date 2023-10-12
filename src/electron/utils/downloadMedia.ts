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

    const lessonsFolder = getDocumentsFolder(null, "Lessons")
    const lessonFolder = path.join(lessonsFolder, lesson.name)
    fs.mkdirSync(lessonFolder, { recursive: true })

    return lesson.files
        .map((file: any) => {
            let extension = ""
            if (file.url.includes(".mp4")) extension = "mp4"
            if (file.url.includes(".jpg")) extension = "jpg"
            if (file.url.includes(".png")) extension = "png"
            if (!extension) return

            let fileName = file.name
            if (!fileName.includes("." + extension)) fileName += "." + extension

            let filePath = path.join(lessonFolder, fileName)

            return downloadFile(filePath, file)
        })
        .filter((a: any) => a)
}

function downloadFile(filePath: string, file: any) {
    if (doesPathExist(filePath)) {
        console.log(filePath + " exists!")
        return { from: file.url, to: filePath, type: file.type }
    }

    // download the media
    const fileStream = fs.createWriteStream(filePath)
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

    return { from: file.url, to: filePath, type: file.type }
}
