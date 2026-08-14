import fs from "fs"
import https from "https"
import { dirname } from "path"
import type { ErrorLog } from "../../types/Main"
import { createLog, logError } from "../IPC/responsesMain"
import { createFolder } from "./files"

export function httpsRequest(hostname: string, path: string, method: "POST" | "GET" | "HEAD", headers: object = {}, content: object = {}, callback: (err: (Error & { statusCode?: number; code?: string; headers?: any }) | null, result?: any) => void, outputFilePath?: string, onlyHeaders = false, timeoutMs = 30000, redirectCount = 0) {
    // a hung response can fire both the request's own "error" (from the timeout destroy) and the
    // response stream's "error"/"end" afterwards - guard so callers only ever see the first result
    let done = false
    const cb: typeof callback = (err, result) => {
        if (done) return
        done = true
        callback(err, result)
    }

    const cleanHostname = hostname.replace(/^https?:\/\//, "")
    const headersObj = headers as Record<string, string>
    const isFormEncoded = headersObj["Content-Type"] === "application/x-www-form-urlencoded"
    let dataString = ""
    if (Object.keys(content).length) {
        if (isFormEncoded) dataString = new URLSearchParams(content as Record<string, string>).toString()
        else dataString = JSON.stringify(content)
    }

    const options = {
        hostname: cleanHostname,
        port: 443,
        path,
        method,
        headers: {
            ...(dataString.length
                ? {
                      "Content-Type": isFormEncoded ? "application/x-www-form-urlencoded" : "application/json",
                      "User-Agent": "Node.js",
                      "Content-Length": Buffer.byteLength(dataString)
                  }
                : {}),
            ...headers
        },
        timeout: timeoutMs
    }

    try {
        const request = https.request(options, (response) => {
            const statusCode = response.statusCode || 0

            const abortWithError = (msg: string, status?: number) => {
                const err: Error & { statusCode?: number; headers?: any } = new Error(msg)
                if (status) err.statusCode = status
                err.headers = response.headers
                response.resume()
                request.destroy()
                cb(err, null)
            }

            // Handle HTTP Redirects (301, 302, 303, 307, 308)
            if ([301, 302, 303, 307, 308].includes(statusCode) && response.headers.location) {
                if (redirectCount >= 5) return abortWithError("HTTP Error: Too many redirects", statusCode)

                response.resume()
                request.destroy()

                try {
                    const redirectUrl = new URL(response.headers.location, `https://${cleanHostname}${path}`)
                    return httpsRequest(redirectUrl.hostname, redirectUrl.pathname + redirectUrl.search, method, headers, content, cb, outputFilePath, onlyHeaders, timeoutMs, redirectCount + 1)
                } catch (urlErr: any) {
                    return cb(urlErr, null)
                }
            }

            if (statusCode >= 300) return abortWithError(`HTTP Error: ${statusCode}`, statusCode)

            if (onlyHeaders) {
                response.resume()
                request.destroy()
                return cb(null, response.headers)
            }

            // Stream response to file
            if (outputFilePath) {
                createFolder(dirname(outputFilePath))
                const fileStream = fs.createWriteStream(outputFilePath)
                let finished = false

                const cleanupAndFail = (err: Error) => {
                    if (finished) return
                    try {
                        response.unpipe(fileStream)
                    } catch {}
                    try {
                        fileStream.destroy()
                    } catch {}
                    response.resume()
                    request.destroy()
                    cb(err, null)
                }

                fileStream.on("error", (err) => {
                    console.error("File write error:", err)
                    cleanupAndFail(err)
                })

                fileStream.on("finish", () => {
                    finished = true
                    cb(null, outputFilePath)
                })

                response.on("error", (err) => {
                    console.error("Response stream error:", err)
                    cleanupAndFail(err)
                })

                response.on("aborted", () => cleanupAndFail(new Error("Response stream aborted")))
                response.on("close", () => {
                    if (!response.complete) cleanupAndFail(new Error("Response connection closed prematurely"))
                })

                response.pipe(fileStream)
            } else {
                // Buffer in memory for JSON parsing
                let data = ""

                response.on("data", (chunk: Buffer | string) => {
                    data += chunk.toString()
                })

                response.on("end", () => {
                    try {
                        if (!data) throw new Error("Empty response")
                        cb(null, JSON.parse(data))
                    } catch (err) {
                        console.error("Error parsing response JSON:", err)
                        cb(err as Error, null)
                    }
                })

                response.on("error", (err) => {
                    console.error("Response error:", err)
                    cb(err, null)
                })
            }
        })

        request.on("error", (err) => {
            console.error("Request error:", err)
            cb(err, null)
        })

        // options.timeout alone only emits this event, it does not abort the connection - without
        // destroying the request here, a hung/slow response left the promise (and callers waiting on
        // it, e.g. cloud sync) unresolved forever.
        request.on("timeout", () => {
            request.destroy(new Error(`Request timed out after ${options.timeout}ms`))
        })

        if (dataString.length) request.write(dataString)
        request.end()
    } catch (err: any) {
        const error: ErrorLog = {
            ...createLog(err),
            type: "Failed HTTPS Request",
            source: hostname + path,
            message: String(err.message) + "\n" + JSON.stringify(content || {})
        }

        logError(error, "request")
        console.error("HTTP Request Error:", err)
        cb(err, null)
    }
}
