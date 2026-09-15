// Draws NDI/OMT/Blackmagic stream frames into a canvas on the GPU (UYVY converts, BGRA swizzles),
// with a CPU path for machines without WebGL.

export type StreamFrame = { xres: number; yres: number; data: Uint8Array | ArrayBuffer; format?: "uyvy" | "rgba" | "bgra" }

const VERTEX_SHADER = "attribute vec2 a;varying vec2 v;void main(){v=vec2((a.x+1.0)*0.5,1.0-(a.y+1.0)*0.5);gl_Position=vec4(a,0.0,1.0);}"
const UYVY_SHADER = [
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

// a packed RGBA texture drawn as it is; `swap` exchanges the red and blue channels for BGRA
const RGBA_SHADER = "precision mediump float;varying vec2 v;uniform sampler2D t;uniform float swap;void main(){vec4 c=texture2D(t,v);gl_FragColor=vec4(mix(c.rgb,c.bgr,swap),1.0);}"

function buildProgram(context: WebGLRenderingContext, fragmentSource = UYVY_SHADER) {
    const vertex = context.createShader(context.VERTEX_SHADER)
    const fragment = context.createShader(context.FRAGMENT_SHADER)
    const program = context.createProgram()
    if (!vertex || !fragment || !program) return null

    context.shaderSource(vertex, VERTEX_SHADER)
    context.compileShader(vertex)
    context.shaderSource(fragment, fragmentSource)
    context.compileShader(fragment)
    context.attachShader(program, vertex)
    context.attachShader(program, fragment)
    context.linkProgram(program)
    if (!context.getProgramParameter(program, context.LINK_STATUS)) return null
    return program
}

// A canvas can only ever have one kind of context, so prove the GPU path on a throwaway canvas first.
// A negative result is NOT cached: WebGL is unavailable while the GPU process is restarting, and caching
// that would put every stream on the CPU for the rest of the session. Re-probing costs one throwaway
// canvas, and only happens on frames that would otherwise take the CPU path anyway.
let gpuConvertSupported: boolean | null = null
let gpuProbedAt = 0
function canConvertOnGPU() {
    if (gpuConvertSupported) return true
    // back off between failed probes by the time since the last one, so a permanently GPU-less machine
    // settles into probing rarely instead of once per frame
    const now = Date.now()
    if (gpuConvertSupported === false && now - gpuProbedAt < Math.min(gpuProbeBackoff, 30000)) return false
    gpuProbedAt = now
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
    gpuProbeBackoff = gpuConvertSupported ? 250 : gpuProbeBackoff * 2
    return gpuConvertSupported
}
let gpuProbeBackoff = 250

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

type GpuProgram = { program: WebGLProgram; uniforms: { [name: string]: WebGLUniformLocation | null } }

export class StreamCanvasRenderer {
    private gl: WebGLRenderingContext | null = null
    private texture: WebGLTexture | null = null
    private programs: { uyvy?: GpuProgram; rgba?: GpuProgram } = {}
    private textureSize = ""
    private ctx2d: CanvasRenderingContext2D | null = null
    private reportedCpu = false
    private lossHooked = false

    draw(canvas: HTMLCanvasElement, frame: StreamFrame) {
        const width = frame.xres
        const height = frame.yres
        if (!width || !height) return
        const data = frame.data instanceof Uint8Array ? frame.data : new Uint8Array(frame.data)

        if (!this.ctx2d && canConvertOnGPU() && this.drawOnGPU(canvas, width, height, data, frame.format)) return
        this.drawOnCPU(canvas, width, height, data, frame.format)
        // this canvas is a 2D canvas for good now, but the element can be replaced: tell whoever owns it
        if (!this.reportedCpu) {
            this.reportedCpu = true
            canvas.dispatchEvent(new CustomEvent("streamcpufallback", { bubbles: true }))
        }
    }

    destroy() {
        this.gl?.getExtension("WEBGL_lose_context")?.loseContext()
        this.gl = null
        this.programs = {}
        this.ctx2d = null
    }

    private initGL(canvas: HTMLCanvasElement) {
        this.gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true })
        if (!this.gl) return false

        // a lost context is recoverable: drop the GL state and rebuild it on the next frame rather than
        // giving up on the GPU for the life of this renderer
        if (!this.lossHooked) {
            this.lossHooked = true
            canvas.addEventListener("webglcontextlost", (e) => {
                e.preventDefault()
                this.gl = null
                this.programs = {}
                this.texture = null
                this.textureSize = ""
            })
        }

        const gl = this.gl
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

        this.texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, this.texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        return true
    }

    // one program per pixel layout, built on first use
    private useProgram(gl: WebGLRenderingContext, packed: boolean): GpuProgram | null {
        const key = packed ? "uyvy" : "rgba"
        let entry = this.programs[key]
        if (!entry) {
            const program = buildProgram(gl, packed ? UYVY_SHADER : RGBA_SHADER)
            if (!program) return null
            entry = { program, uniforms: { w: gl.getUniformLocation(program, "w"), bt: gl.getUniformLocation(program, "bt"), swap: gl.getUniformLocation(program, "swap") } }
            this.programs[key] = entry
        }
        gl.useProgram(entry.program)
        const position = gl.getAttribLocation(entry.program, "a")
        gl.enableVertexAttribArray(position)
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
        return entry
    }

    private drawOnGPU(canvas: HTMLCanvasElement, width: number, height: number, data: Uint8Array, format?: string) {
        if (!this.gl && !this.initGL(canvas)) return false
        const gl = this.gl
        if (!gl) return false

        // UYVY packs two pixels per texel, so its texture is half as wide as the frame
        const packed = format === "uyvy"
        const entry = this.useProgram(gl, packed)
        if (!entry) return false

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
            this.textureSize = ""
        }
        gl.viewport(0, 0, width, height)
        gl.bindTexture(gl.TEXTURE_2D, this.texture)

        const textureWidth = packed ? width / 2 : width
        const size = width + "x" + height + (packed ? "p" : "")
        if (this.textureSize === size) {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, height, gl.RGBA, gl.UNSIGNED_BYTE, data)
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, textureWidth, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
            this.textureSize = size
        }

        if (packed) {
            gl.uniform1f(entry.uniforms.w, width)
            // the capture libraries pick BT.709 above SD heights
            gl.uniform1f(entry.uniforms.bt, height >= 720 ? 1 : 0)
        } else {
            gl.uniform1f(entry.uniforms.swap, format === "bgra" ? 1 : 0)
        }
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
