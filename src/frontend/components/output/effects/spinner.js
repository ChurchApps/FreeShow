export let rays = new Object({
    canvas: false,
    context: false,
    offset: 0,
    speed: 0.005,
    animating: false,
    color_1: "",
    color_2: "",

    mid_x: 0,
    mid_y: 0,
    diameter: 0,
    radius: 0,
    num_rays: 12,
    ray_angle: 0,
    sweep_angle: 0,

    init: function (canvasElem, color_1, color_2) {
        this.canvas = canvasElem
        this.color_1 = color_1
        this.color_2 = color_2

        this.ray_angle = Math.PI / this.num_rays
        this.sweep_angle = this.ray_angle * 2

        this.resetCanvas()
        requestAnimationFrame(this.animate)
        this.draw()
        window.addEventListener("resize", this.resetCanvas)
    },
    animate: function () {
        if (!rays.animating) {
            // prevent calling too frequently if  animating
            rays.animating = true
            rays.update()
            rays.draw()
            window.requestAnimationFrame(rays.animate)
        }
    },
    update: function () {
        rays.offset += rays.speed
    },
    resetCanvas: function () {
        // Resize the canvas and reset context options
        rays.canvas.width = rays.canvas.offsetWidth
        rays.canvas.height = rays.canvas.offsetHeight
        rays.context = rays.canvas.getContext("2d")
        rays.canvas.style.background = rays.color_1
        rays.context.fillStyle = rays.color_2

        // Update vars for drawing (based on the screen size)
        rays.mid_x = rays.canvas.width / 2
        rays.mid_y = rays.canvas.height / 2
        rays.diameter = Math.sqrt(Math.pow(rays.canvas.width, 2) + Math.pow(rays.canvas.height, 2))
        rays.radius = rays.diameter / 2
    },
    draw: function () {
        var c = this.canvas

        this.context.clearRect(0, 0, c.width, c.height)
        this.context.beginPath()
        for (let i = 0; i < this.num_rays; i++) {
            var start_angle = this.sweep_angle * i + this.offset
            var end_angle = start_angle + this.ray_angle

            this.context.moveTo(this.mid_x, this.mid_y)
            this.context.arc(this.mid_x, this.mid_y, this.radius, start_angle, end_angle, false)
        }
        this.context.fill()

        rays.animating = false
    },
})
