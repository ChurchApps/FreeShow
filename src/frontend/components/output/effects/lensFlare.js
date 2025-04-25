export default function lensFlare() {
    "use strict"

    let cvs
    let ctx

    return {
        init: (canvas) => {
            cvs = canvas
            ctx = cvs.getContext("2d")
            cvs.width = window.innerWidth
            cvs.height = window.innerHeight
            const fire = new Flare()
            fire.update({ x: cvs.width / 5, y: cvs.height / 5 })
            // canvas.addEventListener("mousemove", function (a) {
            //     mousePos = getMousePos(cvs, a)
            //     fire.update(mousePos)
            // })
        },
        update: ({ x, y }) => fire.update({ x, y }),
    }

    function Flare() {
        this.discs = []
        this.discNum = 9
        this.t = 0
        this.draw = function (obj) {
            ctx.globalCompositeOperation = "screen"

            const dist = 1 - Math.sqrt(Math.pow(obj.x - cvs.width / 2, 2) + Math.pow(obj.y - cvs.height / 2, 2)) / Math.sqrt(Math.pow(cvs.width / 2, 2) + Math.pow(cvs.height / 2, 2))

            for (let i = 0; i < this.discs.length; i++) {
                ctx.beginPath()
                const hue = this.discs[i].hue
                const grad = ctx.createRadialGradient(this.discs[i].x, this.discs[i].y, 0, this.discs[i].x, this.discs[i].y, this.discs[i].dia)
                grad.addColorStop(0, "hsla(" + hue + ",100%,90%," + 0 * dist + ")")
                grad.addColorStop(0.9, "hsla(" + hue + ",100%,90%," + 0.15 * dist + ")")
                grad.addColorStop(1, "hsla(" + hue + ",100%,90%,0)")
                ctx.fillStyle = grad
                ctx.arc(this.discs[i].x, this.discs[i].y, this.discs[i].dia, 0, Math.PI * 2)
                ctx.closePath()
                ctx.fill()
                if (i === 0) {
                    ctx.beginPath()
                    const grad1 = ctx.createRadialGradient(this.discs[i].x, this.discs[i].y, 0, this.discs[i].x, this.discs[i].y, this.discs[i].dia * 2)
                    grad1.addColorStop(0, "rgba(200,220,255," + 0.2 * dist + ")")
                    grad1.addColorStop(1, "rgba(200,220,255,0)")
                    ctx.fillStyle = grad1
                    ctx.arc(this.discs[i].x, this.discs[i].y, this.discs[i].dia * 2, 0, Math.PI * 2)
                    ctx.closePath()
                    ctx.fill()

                    ctx.beginPath()
                    const ease = function (a, b, t) {
                        return (b - a) * (1 - Math.pow(t - 1, 2)) + a
                    }
                    const spec = ease(this.discs[i].dia / 2.5 / 2, this.discs[i].dia / 2.5, dist)
                    const sdist = 1 - Math.pow(Math.abs(dist - 1), 3)
                    const grad2 = ctx.createRadialGradient(this.discs[i].x, this.discs[i].y, 0, this.discs[i].x, this.discs[i].y, spec)
                    grad2.addColorStop(0.2 * sdist, "rgba(255,255,255," + sdist + ")")
                    grad2.addColorStop(0.6, "hsla(" + this.discs[i].hue + ",100%,75%," + 0.3 * sdist + ")")
                    grad2.addColorStop(1, "hsla(" + this.discs[i].hue + ",100%,40%,0)")
                    ctx.fillStyle = grad2
                    ctx.arc(this.discs[i].x, this.discs[i].y, this.discs[i].dia / 2.5, 0, Math.PI * 2)
                    ctx.closePath()
                    ctx.fill()

                    ctx.beginPath()
                    const grad3 = ctx.createLinearGradient(this.discs[i].x - this.discs[i].dia * 1.5, this.discs[i].y, this.discs[i].x + this.discs[i].dia * 1.5, this.discs[i].y)
                    grad3.addColorStop(0, "rgba(240,250,255,0)")
                    grad3.addColorStop(0.5, "rgba(240,250,255," + 0.4 * dist * dist * dist + ")")
                    grad3.addColorStop(1, "rgba(240,250,255,0)")
                    ctx.fillStyle = grad3
                    ctx.fillRect(this.discs[i].x - this.discs[i].dia * 1.5, this.discs[i].y - 2, this.discs[i].dia * 3, 4)
                    ctx.closePath()
                    ctx.fill()

                    ctx.beginPath()
                    const grad4 = ctx.createLinearGradient(this.discs[i].x, this.discs[i].y - this.discs[i].dia * 1.5, this.discs[i].x, this.discs[i].y + this.discs[i].dia * 1.5)
                    grad4.addColorStop(0, "rgba(240,250,255,0)")
                    grad4.addColorStop(0.5, "rgba(240,250,255," + 0.4 * dist * dist * dist + ")")
                    grad4.addColorStop(1, "rgba(240,250,255,0)")
                    ctx.fillStyle = grad4
                    ctx.fillRect(this.discs[i].x - 2, this.discs[i].y - this.discs[i].dia * 1.5, 4, this.discs[i].dia * 3)
                    ctx.closePath()
                    ctx.fill()
                }
            }
        }

        this.update = function (obj) {
            ctx.clearRect(0, 0, cvs.width, cvs.height)
            for (let i = 0; i <= this.discNum; i++) {
                const temp = {}
                const j = i - this.discNum / 2
                temp.x = (cvs.width / 2 - obj.x) * ((j / this.discNum) * 2) + cvs.width / 2
                temp.y = (cvs.height / 2 - obj.y) * ((j / this.discNum) * 2) + cvs.height / 2
                if (this.t === 0) {
                    temp.dia = Math.pow(Math.abs(10 * (j / this.discNum)), 2) * 3 + 110 + (Math.random() * 100 - 100)
                    temp.hue = Math.round(Math.random() * 360)
                    this.discs[i] = temp
                } else {
                    this.discs[i].x = temp.x
                    this.discs[i].y = temp.y
                }
            }
            this.t += 1
            this.draw(obj)
        }
    }

    // function getMousePos(cvs, evt) {
    //     var rect = cvs.getBoundingClientRect()
    //     return {
    //         x: evt.clientX - rect.left,
    //         y: evt.clientY - rect.top,
    //     }
    // }
}
