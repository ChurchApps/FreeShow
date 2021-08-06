export function Input({title, id, type='text', value, step, fallback, disabled, style, inputValues, setInputValues}) {
  if (!value) {
    if (fallback) value = fallback;
    else {
      if (type === 'number') value = 0;
      else value = '';
    }
  }

  return (
    <span className={disabled ? "fakeInput disabled" : "fakeInput"} style={style}>
      {(type !== 'color' && type !== 'range') && <label style={{margin: '0 2px'}}>{title}</label>}
      <input onChange={e => setInputValues({...inputValues, [id]: e.target.value, changed: id})}
      className="hide" type={type} name={id} id={id} step={step ? step : 1} value={value} disabled={disabled} />
    </span>
  )
}

export function Button({children, id, disabled, style, onClick, active}) {
  return (
    <button id={id} disabled={disabled} style={style} onClick={onClick} className={active ? 'active' : ''}>
      {children}
    </button>
  )
}