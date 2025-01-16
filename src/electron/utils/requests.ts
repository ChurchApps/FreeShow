import https from "https"

export function postRequestSecure(hostname: string, path: string, content: any, cb: (err: any, result?: any) => void) {
    const dataString = JSON.stringify(content)
    const options = {
        hostname: hostname.replace(/^https?:\/\//, ""),
        port: 443,
        path,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "User-Agent": "Node.js",
            "Content-Length": Buffer.byteLength(dataString),
        },
        timeout: 10000,
    }

    try {
        const request = https.request(options, (response) => {
            let data = ""

            response.on("data", (chunk) => {
                data += chunk.toString()
            })

            response.on("end", () => {
                // console.log(`Status code: ${response.statusCode}`)
                if (response.statusCode && response.statusCode >= 400) {
                    cb(new Error(`HTTP Error: ${response.statusCode}`), null)
                    return
                }

                try {
                    const parsedData = JSON.parse(data)
                    cb(null, parsedData)
                } catch (err) {
                    console.error("Error parsing response JSON:", err)
                    cb(err, null)
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

        request.write(dataString)
        request.end()
    } catch (err) {
        console.error("POST Request Error:", err)
    }
}
