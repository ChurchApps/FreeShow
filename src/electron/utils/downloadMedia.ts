import { https } from "follow-redirects"
import fs from "fs"
import path from "path"
import { toApp } from ".."
import { MAIN } from "../../types/Channels"
import { dataFolderNames, doesPathExist, getDataFolder } from "./files"

export function downloadMedia(lessons: any[]) {
    let replace = lessons.map(checkLesson)

    toApp(MAIN, { channel: "REPLACE_MEDIA_PATHS", data: replace.flat() })
}

function checkLesson(lesson: any) {
    const lessonsFolder = getDataFolder(lesson.path, dataFolderNames.lessons)
    const lessonFolder = path.join(lessonsFolder, lesson.name)
    fs.mkdirSync(lessonFolder, { recursive: true })

    return lesson.files
        .map((file: any) => {
            let filePath = getFilePath(file)
            if (!filePath) return

            return downloadFile(filePath, file)
        })
        .filter((a: any) => a)

    function getFilePath(file: any) {
        let extension = getFileExtension(file.url)
        if (!extension) return

        let fileName = file.name
        if (!fileName.includes("." + extension)) fileName += "." + extension

        return path.join(lessonFolder, fileName)
    }
}

function getFileExtension(url: string) {
    if (url.includes(".mp4")) return "mp4"
    if (url.includes(".jpg") || url.includes(".jpeg")) return "jpg"
    if (url.includes(".png")) return "png"

    return ""
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
