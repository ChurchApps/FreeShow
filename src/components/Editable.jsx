import { useContext } from "react";
import { Context } from "../App";
import { convertStyle } from "../functions/TextBox";

export default function Editable({children, active, id}) {
  const [freeShow, setFreeShow] = useContext(Context);

  function change(e) {
    let textbox = e.target.closest('.editable');
    console.log(textbox);
    // let arr = getArray(textbox, {selectionOffset: [0, textbox.children[textbox.children.length - 1].innerText.length], node: [textbox.children[0], textbox.children[textbox.children.length - 1]], selectedText: textbox.innerText});
    // let arr = getArray(textbox);
    let arr = [];
    [...textbox.children].forEach(child => {
      if (child.innerText.length) {
        let style = convertStyle(child.getAttribute('style'));
        arr.push({content: child.innerText, tag: child.tagName.toLowerCase(), style});
      } else arr.push({content: '', tag: 'span', style})
      // WIP: <br> ...
    })
    // console.log(textbox.children, textbox.children.length);
    if (!arr.length) arr.push({content: textbox.innerText || ''});
    // if (textbox.children.length <= 1 && !textbox.children[0]?.innerText.length) arr.push({content: textbox.children[0]?.innerText || '', tag: 'span'})
    let newShow = freeShow;
    newShow.songs[freeShow.activeSong].slides[active][id].text = arr;
    setFreeShow(newShow);
  }
  const style = {outline: 'none', height: 'inherit', overflow: 'auto', userSelect: 'text', whiteSpace: 'pre-wrap', overflowWrap: 'break-word'}
  // WIP: overflow: auto | visible
  return (
    <div onInput={change} onBlur={change}
    contentEditable={true} suppressContentEditableWarning={true}
    style={style} role="textbox" spellCheck="true" className="editable">
      {children}
    </div>
  )
}


// TODO: crtl + a select all tetboxes
// TODO: select multiple slidespreview and change font++ for everything!
// export function textTags(text) {

//   // text = text.replaceAll('</[^>]*>', '');
//   let debug = 0;
//   let textArr = [];
//   let i = 0;
//   console.log('TEXT:', text, text.length);
//   while (i < text.length - 1 && debug < 50) {
//     debug++;
    
//     let tag = null, style = null;
//     let stringStart = i;
//     let stringEnd = text.length;
//     if (text.charAt(i) === '<') {
//       stringStart = text.indexOf('>', i) + 1;
//       tag = text.slice(i + 1, stringStart - 1);
//       if (tag.includes('style')) {
//         style = tag.slice(tag.indexOf('style') + 7, tag.length - 2);
//         tag = tag.slice(0, tag.indexOf(' style'));
//         console.log(style);
//         // style = style.replace(/([a-z])([A-Z])/, '$1-\L$2');
//         style = style.replace(/\-[a-z]/g, match => match.toUpperCase());
//         style = style.replaceAll('-', '');
//         style = style.split('; ');
//         let obj = {};
//         style.forEach(s => obj[s.split(': ')[0]] = s.split(': ')[1]);
//         style = obj;
//         // style = JSON.parse('{"' + style + '"}');
//         console.log(style);
//       }
//     }
//     if (text.indexOf('<', i) >= 0) {
//       stringEnd = text.indexOf('<', stringStart);
//     }
//     console.log('!!!!!!!!!', text.slice(stringStart, stringEnd));
//     textArr.push({tag, content: text.slice(stringStart, stringEnd), style});
//     if (tag !== null) stringEnd += tag.length + 3;
//     // text = text.slice(0, stringEnd);
//     i = stringEnd;
//     console.log(i, text.length);
//   }
//   console.log(textArr);
//   // text = text.replaceAll('</div>', '');
//   // text = text.split('<div>').join('\n');

//   return textArr;
// }