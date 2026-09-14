import OSC from "osc-js"

// https://github.com/ChurchApps/FreeShow/issues/3633

function pad(length: number): number {
    return (length + 3) & ~3
}

function packString(str: string): Uint8Array {
    const encoder = new TextEncoder()
    const encoded = encoder.encode(str)
    const byteLength = pad(encoded.length + 1)
    const buffer = new Uint8Array(byteLength)
    buffer.set(encoded)
    return buffer
}

function packInt32(value: number): Uint8Array {
    const buffer = new Uint8Array(4)
    const dataView = new DataView(buffer.buffer)
    dataView.setInt32(0, value, false)
    return buffer
}

function packInt64(value: bigint | number): Uint8Array {
    const buffer = new Uint8Array(8)
    const dataView = new DataView(buffer.buffer)
    dataView.setBigInt64(0, BigInt(value), false)
    return buffer
}

function packUInt64(value: bigint | number): Uint8Array {
    const buffer = new Uint8Array(8)
    const dataView = new DataView(buffer.buffer)
    dataView.setBigUint64(0, BigInt(value), false)
    return buffer
}

function packFloat32(value: number): Uint8Array {
    const buffer = new Uint8Array(4)
    const dataView = new DataView(buffer.buffer)
    dataView.setFloat32(0, value, false)
    return buffer
}

function packFloat64(value: number): Uint8Array {
    const buffer = new Uint8Array(8)
    const dataView = new DataView(buffer.buffer)
    dataView.setFloat64(0, value, false)
    return buffer
}

function packBlob(value: Uint8Array | ArrayBuffer): Uint8Array {
    const blobBytes = value instanceof Uint8Array ? value : new Uint8Array(value)
    const byteLength = pad(blobBytes.byteLength)
    const buffer = new Uint8Array(byteLength + 4)
    const dataView = new DataView(buffer.buffer)
    dataView.setInt32(0, blobBytes.byteLength, false)
    buffer.set(blobBytes, 4)
    return buffer
}

function patchOSC() {
    if (!OSC?.TypedMessage?.prototype) return

    OSC.TypedMessage.prototype.pack = function pack(this: any): Uint8Array {
        if (!this.address || typeof this.address !== "string" || this.address.length === 0 || this.address[0] !== "/") {
            throw new Error("OSC Message has an invalid address")
        }

        const chunks: Uint8Array[] = []
        chunks.push(packString(this.address))
        chunks.push(packString(`,${this.types || ""}`))

        if (this.args && this.args.length > 0) {
            if (this.args.length > (this.types || "").length) {
                throw new Error("OSC Message argument and type tag mismatch")
            }

            for (let i = 0; i < this.args.length; i++) {
                const type = this.types[i]
                const value = this.args[i]

                if (type === "i") {
                    chunks.push(packInt32(value))
                } else if (type === "h") {
                    chunks.push(packInt64(value))
                } else if (type === "t") {
                    chunks.push(packUInt64(value))
                } else if (type === "f") {
                    chunks.push(packFloat32(value))
                } else if (type === "d") {
                    chunks.push(packFloat64(value))
                } else if (type === "s") {
                    chunks.push(packString(typeof value === "string" ? value : String(value ?? "")))
                } else if (type === "b") {
                    chunks.push(packBlob(value))
                } else if (type === "T" || type === "F" || type === "N" || type === "I") {
                    // Constant types carry no additional data in OSC
                } else {
                    throw new Error("OSC Message found unknown argument type")
                }
            }
        }

        const totalByteLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
        const result = new Uint8Array(totalByteLength)
        let offset = 0
        for (const chunk of chunks) {
            result.set(chunk, offset)
            offset += chunk.byteLength
        }
        return result
    }
}

// apply patch
patchOSC()
