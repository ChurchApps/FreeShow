import https from "https"

export function httpsRequest(hostname: string, path: string, method: "POST" | "GET", headers: object = {}, content: object = {}, cb: (err: (Error & { statusCode?: number; headers?: any }) | null, result?: any) => void) {
    const dataString = Object.keys(content).length ? JSON.stringify(content) : ""
    const options = {
        hostname: hostname.replace(/^https?:\/\//, ""),
        port: 443,
        path,
        method,
        headers: {
            ...(dataString.length
                ? {
                      "Content-Type": "application/json",
                      "User-Agent": "Node.js",
                      "Content-Length": Buffer.byteLength(dataString),
                  }
                : {}),
            ...headers,
        },
        timeout: 10000,
    }

    try {
        const request = https.request(options, (response) => {
            let data = ""

            response.on("data", (chunk: Buffer | string) => {
                data += chunk.toString()
            })

            response.on("end", () => {
                // console.log(`Status code: ${response.statusCode}`)
                if (response.statusCode && response.statusCode >= 400) {
                    const err: Error & { statusCode?: number; headers?: any } = new Error(`HTTP Error: ${response.statusCode}`)
                    err.statusCode = response.statusCode
                    err.headers = response.headers
                    return cb(err, null)
                }

                try {
                    const parsedData = JSON.parse(data)
                    cb(null, parsedData)
                } catch (err) {
                    console.error("Error parsing response JSON:", err)
                    cb(err as Error, null)
                }
            })

            response.on("error", (err) => {
                console.error("Response error:", err)
                cb(err, null)
            })
        })

        request.on("error", (err) => {
            console.error("Request error:", err)
            cb(err, null)
        })

        if (dataString.length) request.write(dataString)
        request.end()
    } catch (err) {
        console.error("HTTP Request Error:", err)
    }
}
