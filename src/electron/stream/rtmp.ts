import { type ChildProcessWithoutNullStreams, spawn } from "child_process"
import type { NativeImage } from "electron"
import ffmpegPath from "ffmpeg-static"
import { CaptureHelper } from "../capture/CaptureHelper"
import { OutputHelper } from "../output/OutputHelper"

interface RTMPData {
    server: string
    serverBackup: string
    key: string
    flags?: string[]
}

export class RTMP {
    static servers: { [key: string]: RTMPData } = {}
    static instances: { [key: string]: ChildProcessWithoutNullStreams } = {}

    static set(id: string, data: Partial<RTMPData>) {
        const currentData = RTMP.servers[id] || {}
        RTMP.servers[id] = {
            server: data.server || currentData.server || "",
            serverBackup: data.serverBackup || currentData.serverBackup || "",
            key: data.key || currentData.key || ""
        }
        RTMP.setFlags(id)
        RTMP.spawn(id)

        // WIP don't start if existing
        CaptureHelper.Lifecycle.startCapture(id, { rtmp: true })
    }

    // e.g: rtmp://a.rtmp.youtube.com/live2/KEY
    private static setFlags(id: string) {
        const framerate = CaptureHelper.getFramerate(id, "rtmp")
        const windowData = OutputHelper.getOutput(id).window
        const resolution = windowData.getBounds()

        const key = RTMP.servers[id].key
        // const getServerURL = (server: string) => `[f=flv]${server}${!key || server.endsWith("/") ? "" : "/"}${key}`

        const server = RTMP.servers[id].server
        // const serverBackup = RTMP.servers[id].serverBackup
        // const servers = [getServerURL(server)]
        // if (serverBackup) servers.push(getServerURL(serverBackup))

        RTMP.servers[id].flags = [
            "-f",
            "rawvideo",
            "-pix_fmt",
            "bgra",
            "-s",
            `${resolution.width}x${resolution.height}`, // 1280x720
            "-r",
            framerate.toString(),
            "-i",
            "pipe:0",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-f",
            "flv",
            // "tee",
            // servers.join("|")
            `${server}${!key || server.endsWith("/") ? "" : "/"}${key}`
        ]

        console.log(RTMP.servers[id].flags) // DEBUG
    }

    private static spawn(id: string) {
        if (!ffmpegPath) return
        if (RTMP.instances[id]) RTMP.stop(id)
        const ffmpeg = spawn(ffmpegPath, RTMP.servers[id].flags)
        RTMP.instances[id] = ffmpeg
        // ffmpeg.on('exit', () => );
    }

    static stop(id: string) {
        RTMP.instances[id]?.kill()
    }

    static stopAll() {
        Object.keys(RTMP.instances).forEach(RTMP.stop)
    }

    static sendFrame(id: string, frame: NativeImage) {
        const data = RTMP.servers[id]
        if (!data || !data.server || !data.flags) return
        const ffmpeg = RTMP.instances[id]
        if (!ffmpeg) return

        const buffer = frame.toBitmap() // BGRA format
        ffmpeg.stdin.write(buffer)
    }
}
