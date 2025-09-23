/* eslint-disable no-shadow */
export function getPresetShapePath(prstGeom, x1, y1, width, height, adj = 0) {
    let path = ""

    const normalizeX = (x) => (x - x1) / width
    const normalizeY = (y) => (y - y1) / height

    // Helper for simple polygons
    const pointsToPath = (points) => points.map((p, i) => `${i === 0 ? "M" : "L"} ${normalizeX(p.x)} ${normalizeY(p.y)}`).join(" ") + " Z"

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
        } case "triangle":
            path = pointsToPath([
                { x: x1 + width / 2, y: y1 },
                { x: x1, y: y1 + height },
                { x: x1 + width, y: y1 + height }
            ])
            break
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
        case "round1Rect":
            // path = pointsToPath([
            //     { x: x1 + width * 0.1, y: y1 },
            //     { x: x1 + width * 0.9, y: y1 },
            //     { x: x1 + width, y: y1 + height * 0.1 },
            //     { x: x1 + width, y: y1 + height * 0.9 },
            //     { x: x1 + width * 0.9, y: y1 + height },
            //     { x: x1 + width * 0.1, y: y1 + height },
            //     { x: x1, y: y1 + height * 0.9 },
            //     { x: x1, y: y1 + height * 0.1 }
            // ])

            const r = 0.2 // normalized radius (0..1)
            const pathPoints = [
                { x: r, y: 0 },           // start after top-left curve
                { x: 1, y: 0 },           // top-right
                { x: 1, y: 1 },           // bottom-right
                { x: 0, y: 1 },           // bottom-left
                { x: 0, y: r },           // left before curve
                { x: 0, y: 0, q: true },  // top-left control point for quadratic curve
                { x: r, y: 0 }            // back to start
            ]

            // Convert to path with quadratic handling
            path = pathPoints.map((p, i) => {
                if (i === 0) return `M ${p.x} ${p.y}`
                if (p.q) {
                    const prev = pathPoints[i - 1]
                    return `Q ${prev.x} ${prev.y} ${p.x} ${p.y}`
                }
                return `L ${p.x} ${p.y}`
            }).join(" ") + " Z"
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
        case "hexagon":
            path = pointsToPath([
                { x: x1 + 0.25 * width, y: y1 },
                { x: x1 + 0.75 * width, y: y1 },
                { x: x1 + width, y: y1 + height / 2 },
                { x: x1 + 0.75 * width, y: y1 + height },
                { x: x1 + 0.25 * width, y: y1 + height },
                { x: x1, y: y1 + height / 2 }
            ])
            break
        case "octagon":
            path = pointsToPath([
                { x: x1 + 0.29 * width, y: y1 },
                { x: x1 + 0.71 * width, y: y1 },
                { x: x1 + width, y: y1 + 0.29 * height },
                { x: x1 + width, y: y1 + 0.71 * height },
                { x: x1 + 0.71 * width, y: y1 + height },
                { x: x1 + 0.29 * width, y: y1 + height },
                { x: x1, y: y1 + 0.71 * height },
                { x: x1, y: y1 + 0.29 * height }
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
        case "flowChartProcess":
            path = pointsToPath([
                { x: x1, y: y1 },
                { x: x1 + width, y: y1 },
                { x: x1 + width, y: y1 + height },
                { x: x1, y: y1 + height }
            ])
            break
        case "roundRect": {
            const r = adj / 100000 * width // simple approximation
            path = `M ${normalizeX(x1 + r)} ${normalizeY(y1)} 
                    L ${normalizeX(x1 + width - r)} ${normalizeY(y1)}
                    Q ${normalizeX(x1 + width)} ${normalizeY(y1)} ${normalizeX(x1 + width)} ${normalizeY(y1 + r)}
                    L ${normalizeX(x1 + width)} ${normalizeY(y1 + height - r)}
                    Q ${normalizeX(x1 + width)} ${normalizeY(y1 + height)} ${normalizeX(x1 + width - r)} ${normalizeY(y1 + height)}
                    L ${normalizeX(x1 + r)} ${normalizeY(y1 + height)}
                    Q ${normalizeX(x1)} ${normalizeY(y1 + height)} ${normalizeX(x1)} ${normalizeY(y1 + height - r)}
                    L ${normalizeX(x1)} ${normalizeY(y1 + r)}
                    Q ${normalizeX(x1)} ${normalizeY(y1)} ${normalizeX(x1 + r)} ${normalizeY(y1)}
                    Z`
            break
        } case "parallelogram": {
            const a = adj / 100000 * Math.min(width, height)
            path = pointsToPath([
                { x: x1 + a, y: y1 },
                { x: x1 + width, y: y1 },
                { x: x1 + width - a, y: y1 + height },
                { x: x1, y: y1 + height }
            ])
            break
        } case "trapezoid": {
            const a = adj / 100000 * Math.min(width, height)
            path = pointsToPath([
                { x: x1 + a, y: y1 },
                { x: x1 + width - a, y: y1 },
                { x: x1 + width, y: y1 + height },
                { x: x1, y: y1 + height }
            ])
            break
        } case "bevel": {
            // Simple 3D beveled rectangle
            const b = adj / 100000 * Math.min(width, height)
            path = `M ${normalizeX(x1 + b)} ${normalizeY(y1)}
                L ${normalizeX(x1 + width - b)} ${normalizeY(y1)}
                L ${normalizeX(x1 + width)} ${normalizeY(y1 + b)}
                L ${normalizeX(x1 + width)} ${normalizeY(y1 + height - b)}
                L ${normalizeX(x1 + width - b)} ${normalizeY(y1 + height)}
                L ${normalizeX(x1 + b)} ${normalizeY(y1 + height)}
                L ${normalizeX(x1)} ${normalizeY(y1 + height - b)}
                L ${normalizeX(x1)} ${normalizeY(y1 + b)}
                Z`
            break
        } case "can": {
            // Cylinder shape
            const r = width / 2
            const h = height
            path = `M ${normalizeX(x1)} ${normalizeY(y1 + h)}
                L ${normalizeX(x1)} ${normalizeY(y1 + h / 4)}
                A ${normalizeX(r)} ${normalizeY(h / 8)} 0 0 1 ${normalizeX(x1 + width)} ${normalizeY(y1 + h / 4)}
                L ${normalizeX(x1 + width)} ${normalizeY(y1 + h)}
                Z`
            break
        } case "bracePair": {
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
        } case "frame": {
            // Picture frame or rectangle with thick border
            const border = adj / 100000 * Math.min(width, height)
            path = pointsToPath([
                { x: x1 + border, y: y1 + border },
                { x: x1 + width - border, y: y1 + border },
                { x: x1 + width - border, y: y1 + height - border },
                { x: x1 + border, y: y1 + height - border }
            ])
            break
        } case "pie": {
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
        } case "arc": {
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
        } case "line": {
            // Simple straight line
            path = `M ${normalizeX(x1)} ${normalizeY(y1)}
                L ${normalizeX(x1 + width)} ${normalizeY(y1 + height)}`
            break
        } case "connector": {
            // Straight or elbow connector
            path = `M ${normalizeX(x1)} ${normalizeY(y1)}
                L ${normalizeX(x1 + width)} ${normalizeY(y1)}
                L ${normalizeX(x1 + width)} ${normalizeY(y1 + height)}`
            break
        } case "chord": {
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
        } case "donut": {
            // Donut = outer ellipse minus inner ellipse
            const outerR = { rx: width / 2, ry: height / 2 }
            const innerR = { rx: width / 4, ry: height / 4 }
            const cx = x1 + width / 2
            const cy = y1 + height / 2

            path = `M ${normalizeX(cx + outerR.rx)} ${normalizeY(cy)}
                A ${normalizeX(outerR.rx)} ${normalizeY(outerR.ry)} 0 1 1 ${normalizeX(cx - outerR.rx)} ${normalizeY(cy)}
                A ${normalizeX(outerR.rx)} ${normalizeY(outerR.ry)} 0 1 1 ${normalizeX(cx + outerR.rx)} ${normalizeY(cy)}
                M ${normalizeX(cx + innerR.rx)} ${normalizeY(cy)}
                A ${normalizeX(innerR.rx)} ${normalizeY(innerR.ry)} 0 1 0 ${normalizeX(cx - innerR.rx)} ${normalizeY(cy)}
                A ${normalizeX(innerR.rx)} ${normalizeY(innerR.ry)} 0 1 0 ${normalizeX(cx + innerR.rx)} ${normalizeY(cy)}
                Z`
            break
        } case "blockArc": {
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
        } case "star": {
            // 5-pointed star
            const cx = x1 + width / 2
            const cy = y1 + height / 2
            const rOuter = width / 2
            const rInner = rOuter * 0.5
            const pts: any[] = []
            for (let i = 0; i < 10; i++) {
                const r = i % 2 === 0 ? rOuter : rInner
                const angle = (Math.PI / 5) * i - Math.PI / 2
                pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
            }
            path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${normalizeX(p.x)} ${normalizeY(p.y)}`).join(" ") + " Z"
            break
        } case "banner": {
            // Simple top banner
            const hOffset = adj / 100000 * height
            path = pointsToPath([
                { x: x1, y: y1 + hOffset },
                { x: x1 + width, y: y1 },
                { x: x1 + width, y: y1 + height - hOffset },
                { x: x1, y: y1 + height }
            ])
            break
        } case "rightArrow": {
            // ✓
            // path = pointsToPath([
            //     { x: 0, y: 0.25 },
            //     { x: 0.75, y: 0.25 },
            //     { x: 0.75, y: 0 },
            //     { x: 1, y: 0.5 },
            //     { x: 0.75, y: 1 },
            //     { x: 0.75, y: 0.75 },
            //     { x: 0, y: 0.75 }
            // ].map(p => ({ x: x1 + p.x * width, y: y1 + p.y * height })))

            const aspect = height / width          // normalized height
            const headFrac = Math.min(1, aspect) * 0.5 // head width = total height in x units

            // Shaft thickness = 50% of height (parametrize if needed)
            const shaftHeight = aspect * 0.5
            const shaftTop = (aspect - shaftHeight) / 2
            const shaftBottom = shaftTop + shaftHeight

            const points = [
                [0, shaftTop],                 // left-top shaft
                [1 - headFrac, shaftTop],      // before head, top
                [1 - headFrac, 0],             // head top
                [1, aspect / 2],               // tip
                [1 - headFrac, aspect],        // head bottom
                [1 - headFrac, shaftBottom],   // before head, bottom
                [0, shaftBottom]               // left-bottom shaft
            ]

            path = points
                .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
                .join(" ") + " Z"
            break
        } case "curvedUpArrow": {
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
        case "plus":
        case "mathPlus": {
            // ✓
            const adj = width * 0.3
            path = pointsToPath([
                { x: x1 + width / 2 - adj / 2, y: y1 },
                { x: x1 + width / 2 + adj / 2, y: y1 },
                { x: x1 + width / 2 + adj / 2, y: y1 + height / 2 - adj / 2 },
                { x: x1 + width, y: y1 + height / 2 - adj / 2 },
                { x: x1 + width, y: y1 + height / 2 + adj / 2 },
                { x: x1 + width / 2 + adj / 2, y: y1 + height / 2 + adj / 2 },
                { x: x1 + width / 2 + adj / 2, y: y1 + height },
                { x: x1 + width / 2 - adj / 2, y: y1 + height },
                { x: x1 + width / 2 - adj / 2, y: y1 + height / 2 + adj / 2 },
                { x: x1, y: y1 + height / 2 + adj / 2 },
                { x: x1, y: y1 + height / 2 - adj / 2 },
                { x: x1 + width / 2 - adj / 2, y: y1 + height / 2 - adj / 2 }
            ])
            break
        } case "downArrowCallout": {
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
        } case "irregularSeal1": {
            // Approx 12-point star seal
            const cx = x1 + width / 2
            const cy = y1 + height / 2
            const rOuter = width / 2
            const rInner = rOuter * 0.7
            const pts: any = []
            for (let i = 0; i < 12; i++) {
                const r = i % 2 === 0 ? rOuter : rInner
                const angle = (Math.PI * 2 / 12) * i - Math.PI / 2
                pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
            }
            path = pointsToPath(pts)
            break
        } case "verticalScroll": {
            const curl = height * 0.05
            path = `M ${normalizeX(x1)} ${normalizeY(y1 + curl)}
                C ${normalizeX(x1)} ${normalizeY(y1)} ${normalizeX(x1 + width)} ${normalizeY(y1)} ${normalizeX(x1 + width)} ${normalizeY(y1 + curl)}
                L ${normalizeX(x1 + width)} ${normalizeY(y1 + height - curl)}
                C ${normalizeX(x1 + width)} ${normalizeY(y1 + height)} ${normalizeX(x1)} ${normalizeY(y1 + height)} ${normalizeX(x1)} ${normalizeY(y1 + height - curl)}
                Z`
            break
        } case "ellipseRibbon": {
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
        } case "star4": {
            // 4-pointed star
            const cx = x1 + width / 2
            const cy = y1 + height / 2
            const rOuter = width / 2
            const rInner = rOuter * 0.5
            const pts = [
                { x: cx, y: cy - rOuter },
                { x: cx + rInner, y: cy },
                { x: cx + rOuter, y: cy },
                { x: cx, y: cy + rInner },
                { x: cx - rOuter, y: cy },
                { x: cx - rInner, y: cy },
            ]
            path = pointsToPath(pts)
            break
        } case "smileyFace": {
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
        } case "callout": {
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
        } default:
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

export function getCustomShapePath(path: any): { pathData: string; vbWidth: number; vbHeight: number } {
    // Collect all points to determine bounding box
    const points: { x: number; y: number }[] = []
    function collectPoints(cmd: any) {
        if (cmd['a:pt']) {
            for (const p of cmd['a:pt']) {
                points.push({ x: parseFloat(p.$.x), y: parseFloat(p.$.y) })
            }
        }
    }
    ['a:moveTo', 'a:lnTo', 'a:arcTo', 'a:quadBezTo', 'a:cubicBezTo'].forEach(type => {
        if (path[type]) {
            for (const cmd of path[type]) {
                collectPoints(cmd)
            }
        }
    })
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity
    points.forEach(pt => {
        if (pt.x < minX) minX = pt.x
        if (pt.y < minY) minY = pt.y
        if (pt.x > maxX) maxX = pt.x
        if (pt.y > maxY) maxY = pt.y
    })
    const boxWidth = maxX - minX || 1
    const boxHeight = maxY - minY || 1
    const aspect = boxWidth / boxHeight
    let vbWidth = 1; let vbHeight = 1
    if (aspect >= 1) {
        vbWidth = 1
        vbHeight = 1 / aspect
    } else {
        vbWidth = aspect
        vbHeight = 1
    }
    // Helper to normalize points to vbWidth/vbHeight range
    function norm(x: string, y: string) {
        let px = boxWidth ? ((parseFloat(x) - minX) / boxWidth) : 0
        let py = boxHeight ? ((parseFloat(y) - minY) / boxHeight) : 0
        // Scale to fit the viewBox
        px *= vbWidth
        py *= vbHeight
        return { x: px.toFixed(4), y: py.toFixed(4) }
    }
    let d = ""
    // MoveTo
    if (path['a:moveTo']) {
        for (const move of path['a:moveTo']) {
            const pt = move['a:pt']?.[0]?.$
            if (pt) {
                const { x, y } = norm(pt.x, pt.y)
                d += `M ${x} ${y} `
            }
        }
    }
    // LineTo
    if (path['a:lnTo']) {
        for (const ln of path['a:lnTo']) {
            const pt = ln['a:pt']?.[0]?.$
            if (pt) {
                const { x, y } = norm(pt.x, pt.y)
                d += `L ${x} ${y} `
            }
        }
    }
    // ArcTo (approximate as line for now)
    if (path['a:arcTo']) {
        for (const arc of path['a:arcTo']) {
            const pts = arc['a:pt'] || []
            if (pts.length > 1) {
                const pt = pts[1]?.$
                if (pt) {
                    const { x, y } = norm(pt.x, pt.y)
                    d += `L ${x} ${y} `
                }
            }
        }
    }
    // QuadBezierTo
    if (path['a:quadBezTo']) {
        for (const quad of path['a:quadBezTo']) {
            const pts = quad['a:pt'] || []
            if (pts.length === 2) {
                const c = norm(pts[0].$.x, pts[0].$.y)
                const p = norm(pts[1].$.x, pts[1].$.y)
                d += `Q ${c.x} ${c.y}, ${p.x} ${p.y} `
            }
        }
    }
    // CubicBezierTo
    if (path['a:cubicBezTo']) {
        for (const cubic of path['a:cubicBezTo']) {
            const pts = cubic['a:pt'] || []
            if (pts.length === 3) {
                const c1 = norm(pts[0].$.x, pts[0].$.y)
                const c2 = norm(pts[1].$.x, pts[1].$.y)
                const p = norm(pts[2].$.x, pts[2].$.y)
                d += `C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p.x} ${p.y} `
            }
        }
    }
    // Close
    if (path['a:close']) {
        d += "Z "
    }
    return { pathData: d.trim(), vbWidth, vbHeight }
}