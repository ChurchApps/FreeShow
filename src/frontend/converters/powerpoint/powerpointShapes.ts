/* eslint-disable no-shadow */
export function getPresetShapePath(prstGeom: string, x1: number, y1: number, width: number, height: number, adjustments: { [key: string]: number } = {}) {
    let path = ""

    // lines can have a zero width/height
    const normalizeX = (x) => (width ? (x - x1) / width : 0.5)
    const normalizeY = (y) => (height ? (y - y1) / height : 0.5)

    const x2 = x1 + width
    const y2 = y1 + height
    const hc = x1 + width / 2
    const vc = y1 + height / 2
    const ss = Math.min(width, height) || Math.max(width, height)

    // adjustment value (in 1/100000) with the shape specific default
    const getAdj = (def: number, name = "adj") => adjustments[name] ?? adjustments[name === "adj" ? "adj1" : name === "adj1" ? "adj" : name] ?? def
    const adj = getAdj(50000)
    const clampRadius = (r: number) => Math.max(0, Math.min(r, width / 2, height / 2))

    // Helper for simple polygons
    const pointsToPath = (points) => points.map((p, i) => `${i === 0 ? "M" : "L"} ${normalizeX(p.x)} ${normalizeY(p.y)}`).join(" ") + " Z"

    // rectangle with individual corner radius (top-left, top-right, bottom-right, bottom-left)
    const roundedRect = (tl: number, tr: number, br: number, bl: number) => {
        const corner = (r: number, x: number, y: number) => (r ? `A ${r / width} ${r / height} 0 0 1 ${normalizeX(x)} ${normalizeY(y)}` : "")
        return [`M ${normalizeX(x1 + tl)} ${normalizeY(y1)}`, `L ${normalizeX(x2 - tr)} ${normalizeY(y1)}`, corner(tr, x2, y1 + tr), `L ${normalizeX(x2)} ${normalizeY(y2 - br)}`, corner(br, x2 - br, y2), `L ${normalizeX(x1 + bl)} ${normalizeY(y2)}`, corner(bl, x1, y2 - bl), `L ${normalizeX(x1)} ${normalizeY(y1 + tl)}`, corner(tl, x1 + tl, y1), "Z"].filter(Boolean).join(" ")
    }

    const ellipsePath = (rx: number, ry: number) => {
        if (!rx || !ry) return ""
        const nrx = rx / width
        const nry = ry / height
        return `M ${normalizeX(hc + rx)} ${normalizeY(vc)} A ${nrx} ${nry} 0 1 1 ${normalizeX(hc - rx)} ${normalizeY(vc)} A ${nrx} ${nry} 0 1 1 ${normalizeX(hc + rx)} ${normalizeY(vc)} Z`
    }

    const starPath = (points: number, innerRatio: number) => {
        const pts: { x: number; y: number }[] = []
        for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? 1 : innerRatio
            const angle = (Math.PI / points) * i - Math.PI / 2
            pts.push({ x: hc + (width / 2) * r * Math.cos(angle), y: vc + (height / 2) * r * Math.sin(angle) })
        }
        return pointsToPath(pts)
    }

    // const pointsToCubicPath = (pts) => {
    //     // pts: array of {x, y, cx1, cy1, cx2, cy2} for each cubic segment
    //     let d = `M ${normalizeX(pts[0].x)} ${normalizeY(pts[0].y)} `
    //     for (let i = 0; i < pts.length; i++) {
    //         const p = pts[i]
    //         d += `C ${normalizeX(p.cx1)} ${normalizeY(p.cy1)} ${normalizeX(p.cx2)} ${normalizeY(p.cy2)} ${normalizeX(p.x)} ${normalizeY(p.y)} `
    //     }
    //     d += 'Z'
    //     return d
    // }

    switch (prstGeom) {
        case "triangle":
        case "flowChartExtract":
            path = pointsToPath([
                { x: x1 + (width * getAdj(50000)) / 100000, y: y1 },
                { x: x1, y: y1 + height },
                { x: x1 + width, y: y1 + height }
            ])
            break
        case "rect":
        case "flowChartProcess":
            path = roundedRect(0, 0, 0, 0)
            break
        case "roundRect":
        case "flowChartAlternateProcess": {
            const r = clampRadius((ss * getAdj(16667)) / 100000)
            path = roundedRect(r, r, r, r)
            break
        }
        case "round1Rect": {
            const r = clampRadius((ss * getAdj(16667)) / 100000)
            path = roundedRect(0, r, 0, 0)
            break
        }
        case "round2SameRect": {
            const r1 = clampRadius((ss * getAdj(16667, "adj1")) / 100000)
            const r2 = clampRadius((ss * getAdj(0, "adj2")) / 100000)
            path = roundedRect(r1, r1, r2, r2)
            break
        }
        case "round2DiagRect": {
            const r1 = clampRadius((ss * getAdj(16667, "adj1")) / 100000)
            const r2 = clampRadius((ss * getAdj(0, "adj2")) / 100000)
            path = roundedRect(r1, r2, r1, r2)
            break
        }
        case "hexagon": {
            const dx = (ss * getAdj(25000)) / 100000
            path = pointsToPath([
                { x: x1 + dx, y: y1 },
                { x: x2 - dx, y: y1 },
                { x: x2, y: vc },
                { x: x2 - dx, y: y2 },
                { x: x1 + dx, y: y2 },
                { x: x1, y: vc }
            ])
            break
        }
        case "octagon": {
            const d = (ss * getAdj(29289)) / 100000
            path = pointsToPath([
                { x: x1 + d, y: y1 },
                { x: x2 - d, y: y1 },
                { x: x2, y: y1 + d },
                { x: x2, y: y2 - d },
                { x: x2 - d, y: y2 },
                { x: x1 + d, y: y2 },
                { x: x1, y: y2 - d },
                { x: x1, y: y1 + d }
            ])
            break
        }
        case "parallelogram": {
            const a = (ss * getAdj(25000)) / 100000
            path = pointsToPath([
                { x: x1 + a, y: y1 },
                { x: x2, y: y1 },
                { x: x2 - a, y: y2 },
                { x: x1, y: y2 }
            ])
            break
        }
        case "trapezoid": {
            const a = (ss * getAdj(25000)) / 100000
            path = pointsToPath([
                { x: x1 + a, y: y1 },
                { x: x2 - a, y: y1 },
                { x: x2, y: y2 },
                { x: x1, y: y2 }
            ])
            break
        }
        case "bevel": {
            // Simple 3D beveled rectangle
            const b = (ss * getAdj(12500)) / 100000
            path = pointsToPath([
                { x: x1 + b, y: y1 },
                { x: x2 - b, y: y1 },
                { x: x2, y: y1 + b },
                { x: x2, y: y2 - b },
                { x: x2 - b, y: y2 },
                { x: x1 + b, y: y2 },
                { x: x1, y: y2 - b },
                { x: x1, y: y1 + b }
            ])
            break
        }
        case "frame": {
            // rectangle with a hole (rendered with evenodd fill)
            const border = (ss * getAdj(12500, "adj1")) / 100000
            path =
                pointsToPath([
                    { x: x1, y: y1 },
                    { x: x2, y: y1 },
                    { x: x2, y: y2 },
                    { x: x1, y: y2 }
                ]) +
                " " +
                pointsToPath([
                    { x: x1 + border, y: y1 + border },
                    { x: x2 - border, y: y1 + border },
                    { x: x2 - border, y: y2 - border },
                    { x: x1 + border, y: y2 - border }
                ])
            break
        }
        case "donut": {
            // Donut = outer ellipse minus inner ellipse (rendered with evenodd fill)
            const thickness = (ss * getAdj(25000)) / 100000
            path = ellipsePath(width / 2, height / 2) + " " + ellipsePath(Math.max(0, width / 2 - thickness), Math.max(0, height / 2 - thickness))
            break
        }
        case "plus":
        case "mathPlus": {
            const d = (ss * getAdj(prstGeom === "plus" ? 25000 : 23520)) / 100000
            path = pointsToPath([
                { x: x1, y: y1 + d },
                { x: x1 + d, y: y1 + d },
                { x: x1 + d, y: y1 },
                { x: x2 - d, y: y1 },
                { x: x2 - d, y: y1 + d },
                { x: x2, y: y1 + d },
                { x: x2, y: y2 - d },
                { x: x2 - d, y: y2 - d },
                { x: x2 - d, y: y2 },
                { x: x1 + d, y: y2 },
                { x: x1 + d, y: y2 - d },
                { x: x1, y: y2 - d }
            ])
            break
        }
        case "rightArrow":
        case "leftArrow": {
            const dy = (height * getAdj(50000, "adj1")) / 200000
            const head = Math.min(width, (ss * getAdj(50000, "adj2")) / 100000)
            const points = [
                { x: x1, y: vc - dy },
                { x: x2 - head, y: vc - dy },
                { x: x2 - head, y: y1 },
                { x: x2, y: vc },
                { x: x2 - head, y: y2 },
                { x: x2 - head, y: vc + dy },
                { x: x1, y: vc + dy }
            ]
            path = pointsToPath(prstGeom === "leftArrow" ? points.map((p) => ({ x: x1 + x2 - p.x, y: p.y })) : points)
            break
        }
        case "downArrow":
        case "upArrow": {
            const dx = (width * getAdj(50000, "adj1")) / 200000
            const head = Math.min(height, (ss * getAdj(50000, "adj2")) / 100000)
            const points = [
                { x: hc - dx, y: y1 },
                { x: hc + dx, y: y1 },
                { x: hc + dx, y: y2 - head },
                { x: x2, y: y2 - head },
                { x: hc, y: y2 },
                { x: x1, y: y2 - head },
                { x: hc - dx, y: y2 - head }
            ]
            path = pointsToPath(prstGeom === "upArrow" ? points.map((p) => ({ x: p.x, y: y1 + y2 - p.y })) : points)
            break
        }
        case "homePlate": {
            const dx = Math.min(width, (ss * getAdj(50000)) / 100000)
            path = pointsToPath([
                { x: x1, y: y1 },
                { x: x2 - dx, y: y1 },
                { x: x2, y: vc },
                { x: x2 - dx, y: y2 },
                { x: x1, y: y2 }
            ])
            break
        }
        case "chevron": {
            const dx = Math.min(width / 2, (ss * getAdj(50000)) / 100000)
            path = pointsToPath([
                { x: x1, y: y1 },
                { x: x2 - dx, y: y1 },
                { x: x2, y: vc },
                { x: x2 - dx, y: y2 },
                { x: x1, y: y2 },
                { x: x1 + dx, y: vc }
            ])
            break
        }
        case "star":
        case "star5":
            path = starPath(5, getAdj(19098) / 50000)
            break
        case "star4":
            path = starPath(4, getAdj(12500) / 50000)
            break
        case "star6":
            path = starPath(6, getAdj(28868) / 50000)
            break
        case "star7":
            path = starPath(7, getAdj(34601) / 50000)
            break
        case "star8":
            path = starPath(8, getAdj(38250) / 50000)
            break
        case "star10":
            path = starPath(10, getAdj(42533) / 50000)
            break
        case "star12":
        case "star16":
        case "star24":
        case "star32":
            path = starPath(Number(prstGeom.slice(4)), getAdj(37500) / 50000)
            break
        case "diagStripe": {
            // ✓
            const a = adj / 100000
            const points = [
                { x: x1 + width * a, y: y1 },
                { x: x1 + width, y: y1 },
                { x: x1, y: y1 + height },
                { x: x1, y: y1 + height * a }
            ]
            path = pointsToPath(points)
            break
        }
        case "rtTriangle":
            // should be right angle

            // const a = width / (width + height) // make it a right angle triangle
            // path = pointsToPath([
            //     { x: x1, y: y1 + height },
            //     { x: x1, y: y1 },
            //     { x: x1 + width, y: y1 + height * a }
            // ])

            path = pointsToPath([
                { x: x1, y: y1 + height },
                { x: x1, y: y1 },
                { x: x1 + width, y: y1 + height }
            ])
            break
        case "diamond":
            path = pointsToPath([
                { x: x1 + width / 2, y: y1 },
                { x: x1 + width, y: y1 + height / 2 },
                { x: x1 + width / 2, y: y1 + height },
                { x: x1, y: y1 + height / 2 }
            ])
            break
        case "pentagon":
            path = pointsToPath([
                { x: x1 + width / 2, y: y1 },
                { x: x1 + width, y: y1 + 0.3771 * height },
                { x: x1 + 0.808 * width, y: y1 + height },
                { x: x1 + 0.192 * width, y: y1 + height },
                { x: x1, y: y1 + 0.3771 * height }
            ])
            break
        case "ellipse":
            // path = `M ${normalizeX(x1 + width / 2)} ${normalizeY(y1)}
            //         A ${normalizeX(width / 2)} ${normalizeY(height / 2)} 0 1 0 ${normalizeX(x1 + width / 2)} ${normalizeY(y1 + height)}
            //         A ${normalizeX(width / 2)} ${normalizeY(height / 2)} 0 1 0 ${normalizeX(x1 + width / 2)} ${normalizeY(y1)} Z`
            // break

            const steps = 64 // increase for smoother ellipse
            const pts: any[] = []
            for (let i = 0; i < steps; i++) {
                const theta = (i / steps) * Math.PI * 2
                const px = x1 + (0.5 + 0.5 * Math.cos(theta)) * width
                const py = y1 + (0.5 + 0.5 * Math.sin(theta)) * height
                pts.push({ x: px, y: py })
            }
            path = pointsToPath(pts) // pointsToPath will call normalizeX/normalizeY
            break
        case "can": {
            // Cylinder shape
            const r = width / 2
            const h = height
            path = `M ${normalizeX(x1)} ${normalizeY(y1 + h)}
                L ${normalizeX(x1)} ${normalizeY(y1 + h / 4)}
                A ${normalizeX(r)} ${normalizeY(h / 8)} 0 0 1 ${normalizeX(x1 + width)} ${normalizeY(y1 + h / 4)}
                L ${normalizeX(x1 + width)} ${normalizeY(y1 + h)}
                Z`
            break
        }
        case "bracePair": {
            // Brace with approximate cubic curves
            path = `M ${normalizeX(x1)} ${normalizeY(y1)}
                C ${normalizeX(x1 + 0.1 * width)} ${normalizeY(y1 + 0.25 * height)} 
                  ${normalizeX(x1 + 0.1 * width)} ${normalizeY(y1 + 0.75 * height)} 
                  ${normalizeX(x1)} ${normalizeY(y1 + height)}
                M ${normalizeX(x1 + width)} ${normalizeY(y1)}
                C ${normalizeX(x1 + 0.9 * width)} ${normalizeY(y1 + 0.25 * height)} 
                  ${normalizeX(x1 + 0.9 * width)} ${normalizeY(y1 + 0.75 * height)} 
                  ${normalizeX(x1 + width)} ${normalizeY(y1 + height)}`
            break
        }
        case "pie": {
            // Pie slice
            const startAngle = 0 // could be based on adjustment
            const endAngle = Math.PI * 2 * (adj / 100000)
            const cx = x1 + width / 2
            const cy = y1 + height / 2
            const rx = width / 2
            const ry = height / 2
            const xStart = cx + rx * Math.cos(startAngle)
            const yStart = cy + ry * Math.sin(startAngle)
            const xEnd = cx + rx * Math.cos(endAngle)
            const yEnd = cy + ry * Math.sin(endAngle)
            const largeArc = endAngle - startAngle > Math.PI ? 1 : 0

            path = `M ${normalizeX(cx)} ${normalizeY(cy)}
                L ${normalizeX(xStart)} ${normalizeY(yStart)}
                A ${normalizeX(rx)} ${normalizeY(ry)} 0 ${largeArc} 1 ${normalizeX(xEnd)} ${normalizeY(yEnd)}
                Z`
            break
        }
        case "arc": {
            // Arc shape
            const startAngle = 0
            const endAngle = Math.PI * 2 * (adj / 100000)
            const cx = x1 + width / 2
            const cy = y1 + height / 2
            const rx = width / 2
            const ry = height / 2
            const xStart = cx + rx * Math.cos(startAngle)
            const yStart = cy + ry * Math.sin(startAngle)
            const xEnd = cx + rx * Math.cos(endAngle)
            const yEnd = cy + ry * Math.sin(endAngle)
            const largeArc = endAngle - startAngle > Math.PI ? 1 : 0

            path = `M ${normalizeX(xStart)} ${normalizeY(yStart)}
                A ${normalizeX(rx)} ${normalizeY(ry)} 0 ${largeArc} 1 ${normalizeX(xEnd)} ${normalizeY(yEnd)}`
            break
        }
        case "line":
        case "straightConnector1": {
            // Simple straight line
            path = `M ${normalizeX(x1)} ${normalizeY(y1)}
                L ${normalizeX(x1 + width)} ${normalizeY(y1 + height)}`
            break
        }
        case "connector":
        case "bentConnector2":
        case "bentConnector3":
        case "curvedConnector2":
        case "curvedConnector3": {
            // Straight or elbow connector
            path = `M ${normalizeX(x1)} ${normalizeY(y1)}
                L ${normalizeX(x1 + width)} ${normalizeY(y1)}
                L ${normalizeX(x1 + width)} ${normalizeY(y1 + height)}`
            break
        }
        case "chord": {
            // Chord is like a pie slice without the center point
            const startAngle = 0
            const endAngle = Math.PI * 2 * (adj / 100000)
            const cx = x1 + width / 2
            const cy = y1 + height / 2
            const rx = width / 2
            const ry = height / 2
            const xStart = cx + rx * Math.cos(startAngle)
            const yStart = cy + ry * Math.sin(startAngle)
            const xEnd = cx + rx * Math.cos(endAngle)
            const yEnd = cy + ry * Math.sin(endAngle)
            const largeArc = endAngle - startAngle > Math.PI ? 1 : 0

            path = `M ${normalizeX(xStart)} ${normalizeY(yStart)}
                A ${normalizeX(rx)} ${normalizeY(ry)} 0 ${largeArc} 1 ${normalizeX(xEnd)} ${normalizeY(yEnd)}
                L ${normalizeX(xStart)} ${normalizeY(yStart)} Z`
            break
        }
        case "blockArc": {
            // Arc with thickness
            const cx = x1 + width / 2
            const cy = y1 + height / 2
            const startAngle = 0
            const endAngle = Math.PI * (adj / 100000)
            const innerR = Math.min(width, height) / 4
            const outerR = Math.min(width, height) / 2

            const x1Outer = cx + outerR * Math.cos(startAngle)
            const y1Outer = cy + outerR * Math.sin(startAngle)
            const x2Outer = cx + outerR * Math.cos(endAngle)
            const y2Outer = cy + outerR * Math.sin(endAngle)
            const x2Inner = cx + innerR * Math.cos(endAngle)
            const y2Inner = cy + innerR * Math.sin(endAngle)
            const x1Inner = cx + innerR * Math.cos(startAngle)
            const y1Inner = cy + innerR * Math.sin(startAngle)
            const largeArc = endAngle - startAngle > Math.PI ? 1 : 0

            path = `M ${normalizeX(x1Outer)} ${normalizeY(y1Outer)}
                A ${normalizeX(outerR)} ${normalizeY(outerR)} 0 ${largeArc} 1 ${normalizeX(x2Outer)} ${normalizeY(y2Outer)}
                L ${normalizeX(x2Inner)} ${normalizeY(y2Inner)}
                A ${normalizeX(innerR)} ${normalizeY(innerR)} 0 ${largeArc} 0 ${normalizeX(x1Inner)} ${normalizeY(y1Inner)}
                Z`
            break
        }
        case "banner": {
            // Simple top banner
            const hOffset = (adj / 100000) * height
            path = pointsToPath([
                { x: x1, y: y1 + hOffset },
                { x: x1 + width, y: y1 },
                { x: x1 + width, y: y1 + height - hOffset },
                { x: x1, y: y1 + height }
            ])
            break
        }
        case "curvedUpArrow": {
            // Upward curved arrow
            const radius = Math.min(width, height) * 0.5
            const cx = x1 + width / 2
            // const cy = y1 + height / 2;
            path = `M ${normalizeX(x1)} ${normalizeY(y1 + height)}
                Q ${normalizeX(cx)} ${normalizeY(y1 - radius * 0.3)} ${normalizeX(x1 + width)} ${normalizeY(y1 + height)}
                L ${normalizeX(x1 + width * 0.75)} ${normalizeY(y1 + height)}
                L ${normalizeX(cx)} ${normalizeY(y1 + height * 0.25)}
                L ${normalizeX(x1 + width * 0.25)} ${normalizeY(y1 + height)}
                Z`
            break
        }
        case "downArrowCallout": {
            path = pointsToPath([
                { x: x1, y: y1 },
                { x: x1 + width, y: y1 },
                { x: x1 + width, y: y1 + height * 0.75 },
                { x: x1 + width / 2 + width * 0.15, y: y1 + height * 0.75 },
                { x: x1 + width / 2, y: y1 + height },
                { x: x1 + width / 2 - width * 0.15, y: y1 + height * 0.75 },
                { x: x1, y: y1 + height * 0.75 }
            ])

            // Fractions
            // const headFrac = 0.3   // arrow head height fraction of total height
            // const shaftFrac = 0.4  // shaft width fraction of total width

            // const bodyHeight = 1 - headFrac
            // const shaftLeft = (1 - shaftFrac) / 2
            // const shaftRight = shaftLeft + shaftFrac

            // path = pointsToPath([
            //     { x: x1 + 0 * width, y: y1 + 0 * height },            // top-left
            //     { x: x1 + 1 * width, y: y1 + 0 * height },            // top-right
            //     { x: x1 + 1 * width, y: y1 + bodyHeight * height },   // right edge before arrow
            //     { x: x1 + shaftRight * width, y: y1 + bodyHeight * height },   // shaft right
            //     { x: x1 + shaftRight * width, y: y1 + 1 * height },            // arrow base right
            //     { x: x1 + 0.5 * width, y: y1 + 1 * height },            // arrow tip
            //     { x: x1 + shaftLeft * width, y: y1 + 1 * height },            // arrow base left
            //     { x: x1 + shaftLeft * width, y: y1 + bodyHeight * height },   // shaft left
            //     { x: x1 + 0 * width, y: y1 + bodyHeight * height }    // back to left edge
            // ])
            break
        }
        case "irregularSeal1": {
            // Approx 12-point star seal
            const cx = x1 + width / 2
            const cy = y1 + height / 2
            const rOuter = width / 2
            const rInner = rOuter * 0.7
            const pts: any = []
            for (let i = 0; i < 12; i++) {
                const r = i % 2 === 0 ? rOuter : rInner
                const angle = ((Math.PI * 2) / 12) * i - Math.PI / 2
                pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
            }
            path = pointsToPath(pts)
            break
        }
        case "verticalScroll": {
            const curl = height * 0.05
            path = `M ${normalizeX(x1)} ${normalizeY(y1 + curl)}
                C ${normalizeX(x1)} ${normalizeY(y1)} ${normalizeX(x1 + width)} ${normalizeY(y1)} ${normalizeX(x1 + width)} ${normalizeY(y1 + curl)}
                L ${normalizeX(x1 + width)} ${normalizeY(y1 + height - curl)}
                C ${normalizeX(x1 + width)} ${normalizeY(y1 + height)} ${normalizeX(x1)} ${normalizeY(y1 + height)} ${normalizeX(x1)} ${normalizeY(y1 + height - curl)}
                Z`
            break
        }
        case "ellipseRibbon": {
            // Elliptical ribbon
            const cx = x1 + width / 2
            const cy = y1 + height / 2
            const rx = width / 2
            const ry = height / 4
            path = `M ${normalizeX(cx - rx)} ${normalizeY(cy - ry)}
                A ${normalizeX(rx)} ${normalizeY(ry)} 0 1 0 ${normalizeX(cx + rx)} ${normalizeY(cy - ry)}
                L ${normalizeX(cx + rx)} ${normalizeY(cy + ry)}
                A ${normalizeX(rx)} ${normalizeY(ry)} 0 1 0 ${normalizeX(cx - rx)} ${normalizeY(cy + ry)}
                Z`
            break
        }
        case "smileyFace": {
            const cx = x1 + width / 2
            const cy = y1 + height / 2
            const r = Math.min(width, height) / 2
            const eyeOffsetX = width * 0.2
            const eyeOffsetY = height * 0.2
            const eyeR = width * 0.05

            path = `M ${normalizeX(cx)} ${normalizeY(cy + r * 0.3)}
                A ${normalizeX(r * 0.5)} ${normalizeY(r * 0.3)} 0 0 0 ${normalizeX(cx)} ${normalizeY(cy + r * 0.5)}
                M ${normalizeX(cx - eyeOffsetX)} ${normalizeY(cy - eyeOffsetY)}
                m -${normalizeX(eyeR)},0 a ${normalizeX(eyeR)} ${normalizeY(eyeR)} 0 1 0 ${normalizeX(eyeR * 2)},0 a ${normalizeX(eyeR)} ${normalizeY(eyeR)} 0 1 0 -${normalizeX(eyeR * 2)},0
                M ${normalizeX(cx + eyeOffsetX)} ${normalizeY(cy - eyeOffsetY)}
                m -${normalizeX(eyeR)},0 a ${normalizeX(eyeR)} ${normalizeY(eyeR)} 0 1 0 ${normalizeX(eyeR * 2)},0 a ${normalizeX(eyeR)} ${normalizeY(eyeR)} 0 1 0 -${normalizeX(eyeR * 2)},0
                `
            break
        }
        case "callout": {
            // Rect with triangular pointer
            const pointerW = width * 0.15
            const pointerH = height * 0.2
            path = pointsToPath([
                { x: x1, y: y1 },
                { x: x1 + width - pointerW, y: y1 },
                { x: x1 + width, y: y1 + pointerH },
                { x: x1 + width, y: y1 + height },
                { x: x1, y: y1 + height }
            ])
            break
        }
        default:
            // fallback: rectangle
            path = pointsToPath([
                { x: x1, y: y1 },
                { x: x1 + width, y: y1 },
                { x: x1 + width, y: y1 + height },
                { x: x1, y: y1 + height }
            ])
            break
    }

    return path
}

// path list from <a:custGeom><a:pathLst>, each <a:path> has its own coordinate space (w/h)
export function getCustomShapePath(pathList: any[], fallbackSize: { w: number; h: number }): { paths: { d: string; noFill?: boolean; noStroke?: boolean }[]; vbWidth: number; vbHeight: number } | null {
    const pathNodes = pathList.filter((node) => node?.["a:path"])
    if (!pathNodes.length) return null

    const firstAttrs = pathNodes[0][":@"] || {}
    const boxWidth = parseFloat(firstAttrs.w) || fallbackSize.w || 1
    const boxHeight = parseFloat(firstAttrs.h) || fallbackSize.h || 1
    const aspect = boxWidth / boxHeight
    let vbWidth = 1
    let vbHeight = 1
    if (aspect >= 1) {
        vbWidth = 1
        vbHeight = 1 / aspect
    } else {
        vbWidth = aspect
        vbHeight = 1
    }

    const paths: { d: string; noFill?: boolean; noStroke?: boolean }[] = []

    pathNodes.forEach((pathNode) => {
        const pathAttrs = pathNode[":@"] || {}
        // path coordinates are in EMU when no size is defined
        const pathGridW = parseFloat(pathAttrs.w) || parseFloat(firstAttrs.w) || fallbackSize.w * 9525 || 1
        const pathGridH = parseFloat(pathAttrs.h) || parseFloat(firstAttrs.h) || fallbackSize.h * 9525 || 1

        const scaleX = vbWidth / pathGridW
        const scaleY = vbHeight / pathGridH
        const fmt = (n: number) => Number(n.toFixed(5))
        const point = (x: number, y: number) => `${fmt(x * scaleX)} ${fmt(y * scaleY)}`
        const getPoints = (cmd: any[]) =>
            (Array.isArray(cmd) ? cmd : [])
                .map((pt) => pt?.[":@"])
                .filter(Boolean)
                .map((pt) => ({ x: parseFloat(pt.x) || 0, y: parseFloat(pt.y) || 0 }))

        // current point (in path units), needed for arcs
        let current = { x: 0, y: 0 }
        let start = { x: 0, y: 0 }
        let d = ""

        for (const cmdNode of pathNode["a:path"] || []) {
            const key = Object.keys(cmdNode || {}).find((k) => k !== ":@")
            if (!key) continue
            const cmd = cmdNode[key]

            if (key === "a:moveTo") {
                const [pt] = getPoints(cmd)
                if (!pt) continue
                current = start = pt
                d += `M ${point(pt.x, pt.y)} `
            } else if (key === "a:lnTo") {
                const [pt] = getPoints(cmd)
                if (!pt) continue
                current = pt
                d += `L ${point(pt.x, pt.y)} `
            } else if (key === "a:quadBezTo") {
                const pts = getPoints(cmd)
                if (pts.length < 2) continue
                current = pts[1]
                d += `Q ${point(pts[0].x, pts[0].y)} ${point(pts[1].x, pts[1].y)} `
            } else if (key === "a:cubicBezTo") {
                const pts = getPoints(cmd)
                if (pts.length < 3) continue
                current = pts[2]
                d += `C ${point(pts[0].x, pts[0].y)} ${point(pts[1].x, pts[1].y)} ${point(pts[2].x, pts[2].y)} `
            } else if (key === "a:arcTo") {
                const attrs = cmdNode[":@"] || {}
                const wR = parseFloat(attrs.wR) || 0
                const hR = parseFloat(attrs.hR) || 0
                const stAng = ((parseFloat(attrs.stAng) || 0) / 60000) * (Math.PI / 180)
                const swAng = ((parseFloat(attrs.swAng) || 0) / 60000) * (Math.PI / 180)
                if (!wR || !hR || !swAng) continue

                // the current point is on the ellipse at the start angle
                const cx = current.x - wR * Math.cos(stAng)
                const cy = current.y - hR * Math.sin(stAng)

                // split into max 180deg segments (svg can't draw a full ellipse with one arc)
                const segments = Math.ceil(Math.abs(swAng) / Math.PI)
                for (let i = 1; i <= segments; i++) {
                    const angle = stAng + (swAng * i) / segments
                    const end = { x: cx + wR * Math.cos(angle), y: cy + hR * Math.sin(angle) }
                    d += `A ${fmt(wR * scaleX)} ${fmt(hR * scaleY)} 0 0 ${swAng > 0 ? 1 : 0} ${point(end.x, end.y)} `
                    current = end
                }
            } else if (key === "a:close") {
                current = start
                d += "Z "
            }
        }

        if (d.trim()) paths.push({ d: d.trim(), noFill: pathAttrs.fill === "none", noStroke: pathAttrs.stroke === "0" || pathAttrs.stroke === "false" })
    })

    return { paths, vbWidth, vbHeight }
}
