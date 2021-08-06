import { useContext } from "react";
import { Context } from "../App";

export default function Slide({style, id, active, setActive, zoom, children}) {
  const [freeShow, setFreeShow] = useContext(Context);

  const slideStyle = {
    backgroundColor: 'black',
    width: freeShow.settings.resolution[0][0] + 'px',
    height: freeShow.settings.resolution[0][1] + 'px',
    fontSize: '5em',
    zoom: (zoom ? zoom : 0.4),
    position: 'relative',
    overflow: 'hidden',
    border: (active ? '20px solid var(--secondary)' : setActive ? '20px solid var(--primary)' : 0),
    boxShadow: '0 0 20px 0 rgb(0 0 0 / 30%)'
  }
  return (
    <div style={{...slideStyle, ...style}} onMouseDown={() => {if (setActive) setActive(id)}} className="slide">
      {children ? children : ''}
    </div>
  );
}