import { useContext, useEffect, useRef, useState } from "react";
import { Context } from "../App";
import Editable from "./Editable";

export default function Resizable({children, style, options, mouse, active, id, activeBox, setActiveBox, setHelperLines, inputValues, setInputValues}) {
  const [freeShow, setFreeShow] = useContext(Context);
  const [mouseTarget, setMouseTarget] = useState(null);
  const textbox = useRef(null);

  // if (!style) style = {left: freeShow.settings.resolution[0][0] / 6 + 'px', top: freeShow.settings.resolution [0][1] / 6 + 'px', width: freeShow.settings.resolution[0][0] / 1.5 + 'px', height: freeShow.settings.resolution[0][1] / 1.5 + 'px'}
  style = {...style, position: 'absolute'}

  // if (id !== activeBox) style = {...style, overflow: 'hidden'}

  if (options.capitalize) style = {...style, textTransform: 'uppercase'}

  const size = 22;
  const square = {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    width: size + 'px',
    height: size + 'px',
    backgroundColor: 'rgb(255 255 255 / 80%)',
    border: '5px solid transparent',
    // outline: '1px solid white',
    borderRadius: '50%'
  }
  const squares = [{top: 0, left: 0, cursor: 'nw-resize'}, {top: 0, left: '50%', cursor: 'n-resize'}, {top: 0, left: '100%', cursor: 'ne-resize'}, {top: '50%', left: '100%', cursor: 'e-resize'}, {top: '100%', left: '100%', cursor: 'se-resize'}, {top: '100%', left: '50%', cursor: 's-resize'}, {top: '100%', left: 0, cursor: 'sw-resize'}, {top: '50%', left: 0, cursor: 'w-resize'}];

  const lineWidth = '5px';
  const lines = [{top: 0, left: 0, height: lineWidth, width: '100%', transform: 'translateY(-50%)'}, {top: 0, left: '100%', height: '100%', width: lineWidth, transform: 'translateX(-50%)'}, {top: '100%', left: 0, height: lineWidth, width: '100%', transform: 'translateY(-50%)'}, {top: 0, left: 0, height: '100%', width: lineWidth, transform: 'translateX(-50%)'}]
  const invLines = [{...lines[0], height: size}, {...lines[1], width: size}, {...lines[2], height: size}, {...lines[3], width: size}]


  useEffect(() => {
    if (mouse.down && mouse.e.target.closest('.textbox') === textbox.current && !mouse.e.target.closest('.editable')) {
      let zoom = .4;
      let min = 50;
      console.log(mouse.e);
      // mouse.e.preventDefault();
      let newStyle = {};
      let newHelperLines = [];

      if (mouse.e.target.className === 'square') {
        if (mouse.e.target.id === '0' || mouse.e.target.id === '1' || mouse.e.target.id === '2') {
          let top = textbox.current.offsetTop - mouse.secondPos.y / zoom;
          let height = textbox.current.offsetHeight + textbox.current.offsetTop - top;
          if (height > min) {
            newStyle.top = top;
            newStyle.height = height;
          }
        }
        if (mouse.e.target.id === '2' || mouse.e.target.id === '3' || mouse.e.target.id === '4') {
          let width = mouse.pos.x / zoom - (textbox.current.offsetLeft + 478);
          if (width <= min) width = min;
          newStyle.width = width;
        }
        if (mouse.e.target.id === '4' || mouse.e.target.id === '5' || mouse.e.target.id === '6') {
          let height = mouse.pos.y / zoom - (textbox.current.offsetTop + 60);
          if (height <= min) height = min;
          newStyle.height = height;  
          console.log(textbox.current.closest('.slide').offsetTop);
        }
        if (mouse.e.target.id === '6' || mouse.e.target.id === '7' || mouse.e.target.id === '0') {
          let left = textbox.current.offsetLeft - mouse.secondPos.x / zoom;
          let width = textbox.current.offsetWidth + textbox.current.offsetLeft - left;
          if (width > min) {
            newStyle.left = left;
            newStyle.width = width;
          }
        }
      } else {
        // let left = Number(textbox.current.style.left.replace(/\D+/g, ''));
        // let top = Number(textbox.current.style.top.replace(/\D+/g, ''));
        console.log(textbox.current.offsetLeft);
        newStyle.left = textbox.current.offsetLeft - mouse.secondPos.x / zoom;
        newStyle.top = textbox.current.offsetTop - mouse.secondPos.y / zoom;

        let slideWidth = textbox.current.closest('.slide').offsetWidth;
        let slideHeight = textbox.current.closest('.slide').offsetHeight;
        let differenceX = (textbox.current.offsetLeft + textbox.current.offsetWidth / 2) - slideWidth / 2;
        let differenceY = (textbox.current.offsetTop + textbox.current.offsetHeight / 2) - slideHeight / 2;

        let margin = 20;
        if (differenceX < margin && differenceX > -margin) {
          newHelperLines.push(['x', slideWidth / 2]);
          // WIP
          // newStyle.left = slideWidth / 2 - textbox.current.offsetWidth / 2;
        }
        if (differenceY < margin && differenceY > -margin) {
          newHelperLines.push(['y', slideHeight / 2]);
          // newStyle.top = slideHeight / 2 - textbox.current.offsetHeight / 2;
        }
      }
      console.log(newHelperLines);
      setHelperLines(newHelperLines);

      // TODO: no drag squares & lines++!

      console.log(newStyle);

      setInputValues({...inputValues, ...newStyle});
      
      let newShow = freeShow;
      newShow.songs[freeShow.activeSong].slides[active][id].style = {...newShow.songs[freeShow.activeSong].slides[active][id].style, ...newStyle};
      // setFreeShow(newShow);
      console.log(newShow);
    }
  }, [mouse])



  return (
    <div ref={textbox} style={style} onMouseDown={() => setActiveBox(id)} className="textbox noselect">
      {lines.map((pos, i) => <div key={i} style={{position: 'absolute', backgroundColor: (id === activeBox ? 'rgb(255 255 255 / 50%)' : 'rgb(255 255 255 / 20%)'), ...pos}}></div>)}
      {invLines.map((pos, i) => <div key={i} style={{position: 'absolute', backgroundColor: 'transparent', cursor: 'move', ...pos}}></div>)}
      {id === activeBox && squares.map((pos, i) => <div key={i} id={i} className="square" style={{...square, ...pos}}></div>)}
      <Editable active={active} id={id}>{children}</Editable>
    </div>
  )
}