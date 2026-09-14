// Draws NDI/OMT stream frames into a canvas: UYVY frames convert on the GPU, with a CPU path for
// RGBA/BGRA frames and machines without WebGL.

export type StreamFrame = { xres: number; yres: number; data: Uint8Array | ArrayBuffer; format?: "uyvy" | "rgba" | "bgra" }

const VERTEX_SHADER = "attribute vec2 a;varying vec2 v;void main(){v=vec2((a.x+1.0)*0.5,1.0-(a.y+1.0)*0.5);gl_Position=vec4(a,0.0,1.0);}"
const FRAGMENT_SHADER = [
    "precision highp float;varying vec2 v;uniform sampler2D t;uniform float w;uniform float bt;",
    "void main(){",
    // each texel holds two pixels: U Y0 V Y1
    " float x=v.x*w; float pix=floor(x); float texel=floor(pix*0.5);",
    " vec4 s=texture2D(t, vec2((texel+0.5)/(w*0.5), v.y));",
    " float Y = mod(pix,2.0)<0.5 ? s.g : s.a;",
    " float y=(Y-16.0/255.0)*(255.0/219.0);",
    " float u=(s.r-128.0/255.0)*(255.0/224.0);",
    " float c=(s.b-128.0/255.0)*(255.0/224.0);",
    " float kr=mix(1.402,1.5748,bt), kb=mix(1.772,1.8556,bt);",
    " float gu=mix(0.344136,0.1873,bt), gv=mix(0.714136,0.4681,bt);",
    " gl_FragColor=vec4(clamp(y+kr*c,0.0,1.0),clamp(y-gu*u-gv*c,0.0,1.0),clamp(y+kb*u,0.0,1.0),1.0);}"
].join("")

function buildProgram(context: WebGLRenderingContext) {
    const vertex = context.createShader(context.VERTEX_SHADER)
    const fragment = context.createShader(context.FRAGMENT_SHADER)
    const program = context.createProgram()
    if (!vertex || !fragment || !program) return null

    context.shaderSource(vertex, VERTEX_SHADER)
    context.compileShader(vertex)
    context.shaderSource(fragment, FRAGMENT_SHADER)
    context.compileShader(fragment)
    context.attachShader(program, vertex)
    context.attachShader(program, fragment)
    context.linkProgram(program)
    if (!context.getProgramParameter(program, context.LINK_STATUS)) return null
    return program
}

// A canvas can only ever have one kind of context, so prove the GPU path on a throwaway canvas first.
let gpuConvertSupported: boolean | null = null
function canConvertOnGPU() {
    if (gpuConvertSupported !== null) return gpuConvertSupported
    gpuConvertSupported = false
    try {
        const probe = document.createElement("canvas").getContext("webgl")
        if (probe) {
            gpuConvertSupported = !!buildProgram(probe)
            probe.getExtension("WEBGL_lose_context")?.loseContext()
        }
    } catch (err) {
        console.warn("[stream] GPU frame conversion unavailable:", err)
    }
    return gpuConvertSupported
}

function uyvyToRGBA(source: Uint8Array, width: number, height: number) {
    const out = new Uint8ClampedArray(width * height * 4)
    const bt709 = height >= 720
    const kr = bt709 ? 1.5748 : 1.402
    const kb = bt709 ? 1.8556 : 1.772
    const gu = bt709 ? 0.1873 : 0.344136
    const gv = bt709 ? 0.4681 : 0.714136

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x += 2) {
            const i = y * width * 2 + x * 2
            const u = (source[i] - 128) / 224
            const c = (source[i + 2] - 128) / 224
            for (let k = 0; k < 2; k++) {
                const luma = ((k === 0 ? source[i + 1] : source[i + 3]) - 16) / 219
                const o = (y * width + x + k) * 4
                out[o] = (luma + kr * c) * 255
                out[o + 1] = (luma - gu * u - gv * c) * 255
                out[o + 2] = (luma + kb * u) * 255
                out[o + 3] = 255
            }
        }
    }
    return out
}

export class StreamCanvasRenderer {
    private gl: WebGLRenderingContext | null = null
    private texture: WebGLTexture | null = null
    private widthUniform: WebGLUniformLocation | null = null
    private matrixUniform: WebGLUniformLocation | null = null
    private textureSize = ""
    private ctx2d: CanvasRenderingContext2D | null = null

    draw(canvas: HTMLCanvasElement, frame: StreamFrame) {
        const width = frame.xres
        const height = frame.yres
        if (!width || !height) return
        const data = frame.data instanceof Uint8Array ? frame.data : new Uint8Array(frame.data)

        if (frame.format === "uyvy" && !this.ctx2d && canConvertOnGPU() && this.drawOnGPU(canvas, width, height, data)) return
        this.drawOnCPU(canvas, width, height, data, frame.format)
    }

    destroy() {
        this.gl?.getExtension("WEBGL_lose_context")?.loseContext()
        this.gl = null
        this.ctx2d = null
    }

    private initGL(canvas: HTMLCanvasElement) {
        this.gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true })
        const program = this.gl ? buildProgram(this.gl) : null
        if (!this.gl || !program) return false

        const gl = this.gl
        gl.useProgram(program)
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
        const position = gl.getAttribLocation(program, "a")
        gl.enableVertexAttribArray(position)
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

        this.texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, this.texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        this.widthUniform = gl.getUniformLocation(program, "w")
        this.matrixUniform = gl.getUniformLocation(program, "bt")
        return true
    }

    private drawOnGPU(canvas: HTMLCanvasElement, width: number, height: number, data: Uint8Array) {
        if (!this.gl && !this.initGL(canvas)) return false
        const gl = this.gl
        if (!gl) return false

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
            this.textureSize = ""
        }
        gl.viewport(0, 0, width, height)
        gl.bindTexture(gl.TEXTURE_2D, this.texture)

        const size = width + "x" + height
        if (this.textureSize === size) {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width / 2, height, gl.RGBA, gl.UNSIGNED_BYTE, data)
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width / 2, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
            this.textureSize = size
        }

        gl.uniform1f(this.widthUniform, width)
        // the capture libraries pick BT.709 above SD heights
        gl.uniform1f(this.matrixUniform, height >= 720 ? 1 : 0)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        return true
    }

    private drawOnCPU(canvas: HTMLCanvasElement, width: number, height: number, data: Uint8Array, format?: string) {
        if (!this.ctx2d) this.ctx2d = canvas.getContext("2d")
        const ctx = this.ctx2d
        if (!ctx) return

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
        }

        let pixels: Uint8ClampedArray
        if (format === "uyvy") {
            pixels = uyvyToRGBA(data, width, height)
        } else {
            pixels = new Uint8ClampedArray(data)
            if (format === "bgra") {
                const words = new Uint32Array(pixels.buffer)
                for (let i = 0; i < words.length; i++) {
                    const p = words[i]
                    words[i] = (p & 0xff00ff00) | ((p & 0x00ff0000) >>> 16) | ((p & 0x000000ff) << 16)
                }
            }
        }
        ctx.putImageData(new ImageData(pixels, width, height), 0, 0)
    }
}
