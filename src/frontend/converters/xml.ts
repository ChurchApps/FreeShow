/*	This work is licensed under Creative Commons GNU LGPL License.

	License: http://creativecommons.org/licenses/LGPL/2.1/
   Version: 0.9
	Author:  Stefan Goessner/2006
	Web:     http://goessner.net/ 
*/
export function xml2json(xmlString: string, removeBreaks: boolean = false) {
    let xml: any = xmlParser(xmlString, removeBreaks)

    let X = {
        toObj: (xml) => {
            if (xml.nodeType == 1) {
                let o: any = {}

                // element node ..
                if (xml.attributes.length)
                    // element with attributes  ..
                    for (let i = 0; i < xml.attributes.length; i++) o["@" + xml.attributes[i].nodeName] = X.escape((xml.attributes[i].nodeValue || "").toString())

                if (xml.firstChild) {
                    // element has child nodes ..
                    let textChild = 0,
                        cdataChild = 0,
                        hasElementChild = false

                    for (let n = xml.firstChild; n; n = n.nextSibling) {
                        if (n.nodeType == 1) hasElementChild = true
                        else if (n.nodeType == 3 && n.nodeValue.match(/[^ \f\n\r\t\v]/)) textChild++ // non-whitespace text
                        else if (n.nodeType == 4) cdataChild++ // cdata section node
                    }

                    if (hasElementChild) {
                        if (textChild < 2 && cdataChild < 2) {
                            // structured element with evtl. a single text or/and cdata node ..
                            X.removeWhite(xml)
                            for (let n = xml.firstChild; n; n = n.nextSibling) {
                                if (n.nodeType == 3)
                                    // text node
                                    o["#text"] = X.escape(n.nodeValue)
                                else if (n.nodeType == 4)
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

            if (xml.nodeType == 9) {
                // document.node
                return X.toObj(xml.documentElement)
            }

            return console.error("unhandled node type: " + xml.nodeType)
        },
        toJson: (o, name, ind) => {
            let json = name ? '"' + name + '"' : ""

            if (o instanceof Array) {
                for (let i = 0, n = o.length; i < n; i++) o[i] = X.toJson(o[i], "", ind + "\t")
                return json + (name ? ":[" : "[") + (o.length > 1 ? "\n" + ind + "\t" + o.join(",\n" + ind + "\t") + "\n" + ind : o.join("")) + "]"
            }

            if (o == null) return json + (name && ":") + "null"

            if (typeof o == "object") {
                let arr: string[] = []
                for (let m in o) arr[arr.length] = X.toJson(o[m], m, ind + "\t")
                return json + (name ? ":{" : "{") + (arr.length > 1 ? "\n" + ind + "\t" + arr.join(",\n" + ind + "\t") + "\n" + ind : arr.join("")) + "}"
            }

            if (typeof o == "string") return json + (name && ":") + '"' + o.toString() + '"'

            return json + (name && ":") + o.toString()
        },
        innerXml: (node) => {
            if ("innerHTML" in node) return node.innerHTML

            let s = ""
            let asXml = (n) => {
                if (n.nodeType == 1) {
                    let s = ""
                    s += "<" + n.nodeName
                    for (let i = 0; i < n.attributes.length; i++) s += " " + n.attributes[i].nodeName + '="' + (n.attributes[i].nodeValue || "").toString() + '"'

                    if (n.firstChild) {
                        s += ">"
                        for (let c = n.firstChild; c; c = c.nextSibling) s += asXml(c)
                        s += "</" + n.nodeName + ">"
                        return s
                    }

                    return s + "/>"
                }

                if (n.nodeType == 3) return n.nodeValue
                if (n.nodeType == 4) return "<![CDATA[" + n.nodeValue + "]]>"
            }

            for (let c = node.firstChild; c; c = c.nextSibling) s += asXml(c)
            return s
        },
        escape: (txt) => {
            return txt.replace(/[\\]/g, "\\\\").replace(/[\"]/g, '\\"').replace(/[\n]/g, "\\n").replace(/[\r]/g, "\\r")
        },
        removeWhite: (e) => {
            e.normalize()
            for (let n = e.firstChild; n; ) {
                if (n.nodeType == 3) {
                    // text node
                    if (!n.nodeValue.match(/[^ \f\n\r\t\v]/)) {
                        // pure whitespace text node
                        let nxt = n.nextSibling
                        e.removeChild(n)
                        n = nxt
                    } else {
                        n = n.nextSibling
                    }
                } else if (n.nodeType == 1) {
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
    if (xml.nodeType == 9) xml = xml.documentElement

    let json = X.toJson(X.toObj(X.removeWhite(xml)), xml.nodeName, "\t")
    json = "{" + json.replace(/\t|\n/g, "") + "}"

    // in some cases propresenter will have this in the song metadata, making the json "bad escaped"
    json = json.replaceAll("N\\A", "")

    let parsedJson: any = {}

    try {
        parsedJson = JSON.parse(json)
    } catch (e: any) {
        console.error(e)
        let pos = Number(e.toString().replace(/\D+/g, "") || 100)
        console.log(pos, json.slice(pos - 5, pos + 5), json.slice(pos - 100, pos + 100))
    }

    return parsedJson
}

function xmlParser(xml: string, removeBreaks: boolean = false) {
    let parser = new DOMParser()

    // // fix for xml files without any line breaks
    // let versionText = xml.indexOf("?>")
    // if (versionText > 0 && versionText < 80) xml = xml.slice(versionText, xml.length)

    // remove first line (standalone attribute): <?xml version="1.0" encoding="UTF-8"?> / <?xml-stylesheet href="stylesheets.css" type="text/css"?>
    while (xml.indexOf("<?xml") >= 0) {
        let splitted = xml.split("\n")
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
