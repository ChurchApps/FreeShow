/* eslint @typescript-eslint/restrict-plus-operands: 0 */
/*	This work is licensed under Creative Commons GNU LGPL License.

	License: http://creativecommons.org/licenses/LGPL/2.1/
   Version: 0.9
	Author:  Stefan Goessner/2006
	Web:     http://goessner.net/ 
*/
export function xml2json(xmlString: string, removeBreaks = false) {
    let xmlData: any = xmlParser(xmlString, removeBreaks)

    const X = {
        toObj: (xml) => {
            if (xml.nodeType === 1) {
                let o: any = {}

                // element node ..
                if (xml.attributes.length)
                    // element with attributes  ..
                    for (const attr of xml.attributes) o["@" + attr.nodeName] = X.escape((attr.nodeValue || "").toString())

                if (xml.firstChild) {
                    // element has child nodes ..
                    let textChild = 0
                    let cdataChild = 0
                    let hasElementChild = false

                    for (let n = xml.firstChild; n; n = n.nextSibling) {
                        if (n.nodeType === 1) hasElementChild = true
                        else if (n.nodeType === 3 && n.nodeValue.match(/[^ \f\n\r\t\v]/))
                            textChild++ // non-whitespace text
                        else if (n.nodeType === 4) cdataChild++ // cdata section node
                    }

                    if (hasElementChild) {
                        if (textChild < 2 && cdataChild < 2) {
                            // structured element with evtl. a single text or/and cdata node ..
                            X.removeWhite(xml)
                            for (let n = xml.firstChild; n; n = n.nextSibling) {
                                if (n.nodeType === 3)
                                    // text node
                                    o["#text"] = X.escape(n.nodeValue)
                                else if (n.nodeType === 4)
                                    // cdata node
                                    o["#cdata"] = X.escape(n.nodeValue)
                                else if (o[n.nodeName]) {
                                    // multiple occurence of element ..
                                    if (o[n.nodeName] instanceof Array) o[n.nodeName][o[n.nodeName].length] = X.toObj(n)
                                    else o[n.nodeName] = [o[n.nodeName], X.toObj(n)]
                                } // first occurence of element..
                                else o[n.nodeName] = X.toObj(n)
                            }
                        } else {
                            // mixed content
                            if (!xml.attributes.length) o = X.escape(X.innerXml(xml))
                            else o["#text"] = X.escape(X.innerXml(xml))
                        }
                    } else if (textChild) {
                        // pure text
                        if (!xml.attributes.length) o = X.escape(X.innerXml(xml))
                        else o["#text"] = X.escape(X.innerXml(xml))
                    } else if (cdataChild) {
                        // cdata
                        if (cdataChild > 1) o = X.escape(X.innerXml(xml))
                        else for (let n = xml.firstChild; n; n = n.nextSibling) o["#cdata"] = X.escape(n.nodeValue)
                    }
                }

                if (!xml.attributes.length && !xml.firstChild) o = null

                return o
            }

            if (xml.nodeType === 9) {
                // document.node
                return X.toObj(xml.documentElement)
            }

            return console.error("unhandled node type: " + xml.nodeType)
        },
        toJson: (o, name, ind) => {
            const jsonValue = name ? '"' + name + '"' : ""

            if (o instanceof Array) {
                for (let i = 0, n = o.length; i < n; i++) o[i] = X.toJson(o[i], "", ind + "\t")
                return jsonValue + (name ? ":[" : "[") + (o.length > 1 ? "\n" + ind + "\t" + o.join(",\n" + ind + "\t") + "\n" + ind : o.join("")) + "]"
            }

            if (o === null) return jsonValue + (name && ":") + "null"

            if (typeof o === "object") {
                const arr: string[] = []
                // eslint-disable-next-line
                for (const m in o) arr[arr.length] = X.toJson(o[m], m, ind + "\t")
                return jsonValue + (name ? ":{" : "{") + (arr.length > 1 ? "\n" + ind + "\t" + arr.join(",\n" + ind + "\t") + "\n" + ind : arr.join("")) + "}"
            }

            if (typeof o === "string") return jsonValue + (name && ":") + '"' + o.toString() + '"'

            return jsonValue + (name && ":") + o.toString()
        },
        innerXml: (node) => {
            if ("innerHTML" in node) return node.innerHTML

            const asXml = (n) => {
                if (n.nodeType === 1) {
                    let s = ""
                    s += "<" + n.nodeName
                    for (const attr of n.attributes) s += " " + attr.nodeName + '="' + (attr.nodeValue || "").toString() + '"'

                    if (n.firstChild) {
                        s += ">"
                        for (let c = n.firstChild; c; c = c.nextSibling) s += asXml(c)
                        s += "</" + n.nodeName + ">"
                        return s
                    }

                    return s + "/>"
                }

                if (n.nodeType === 3) return n.nodeValue
                if (n.nodeType === 4) return "<![CDATA[" + n.nodeValue + "]]>"
            }

            let fullString = ""
            for (let c = node.firstChild; c; c = c.nextSibling) fullString += asXml(c)
            return fullString
        },
        escape: (txt) => {
            return txt.replace(/[\\]/g, "\\\\").replace(/[\"]/g, '\\"').replace(/[\n]/g, "\\n").replace(/[\r]/g, "\\r")
        },
        removeWhite: (e) => {
            e.normalize()
            for (let n = e.firstChild; n; ) {
                if (n.nodeType === 3) {
                    // text node
                    if (!n.nodeValue.match(/[^ \f\n\r\t\v]/)) {
                        // pure whitespace text node
                        const nxt = n.nextSibling
                        e.removeChild(n)
                        n = nxt
                    } else {
                        n = n.nextSibling
                    }
                } else if (n.nodeType === 1) {
                    // element node
                    X.removeWhite(n)
                    n = n.nextSibling
                } else {
                    // any other node
                    n = n.nextSibling
                }
            }
            return e
        },
    }

    // document node
    if (xmlData.nodeType === 9) xmlData = xmlData.documentElement

    let json = X.toJson(X.toObj(X.removeWhite(xmlData)), xmlData.nodeName, "\t")
    json = "{" + json.replace(/\t|\n/g, "") + "}"

    // in some cases propresenter will have this in the song metadata, making the json "bad escaped"
    json = json.replaceAll("N\\A", "")

    let parsedJson: any = {}

    try {
        parsedJson = JSON.parse(json)
    } catch (e: any) {
        console.error(e)
        const pos = Number(e.toString().replace(/\D+/g, "") || 100)
        console.info(pos, json.slice(pos - 5, pos + 5), json.slice(pos - 100, pos + 100))
    }

    return parsedJson
}

function xmlParser(xml: string, removeBreaks = false) {
    const parser = new DOMParser()

    // // fix for xml files without any line breaks
    const versionText = xml.indexOf("?>")
    if (versionText > 0 && versionText < 80) xml = xml.slice(versionText + 2, xml.length)

    // remove first line (standalone attribute): <?xml version="1.0" encoding="UTF-8"?> / <?xml-stylesheet href="stylesheets.css" type="text/css"?>
    while (xml.indexOf("<?xml") >= 0) {
        const splitted = xml.split("\n")
        xml = splitted.slice(1, splitted.length).join("\n")
    }

    // remove first unknown char to ensure correct xml
    if (xml[0] !== "<") xml = xml.slice(xml.indexOf("<"), xml.length)

    // remove special html chars
    xml = xml.replaceAll("&nbsp;", "").replaceAll("&bull;", "")

    // remove line breaks
    if (removeBreaks) xml = xml.replaceAll("<br>", "").replaceAll("<br/>", "").replaceAll("<br />", "")

    return parser.parseFromString(xml, "text/xml").children[0]
}
