import React, { cloneElement, isValidElement, useId } from 'react';

export default function FormField({ label, children }) {
  const generatedId = useId();
  const items = Array.isArray(children) ? children : [children];
  const controlIndex = items.findIndex(isValidElement);
  const existingId = controlIndex >= 0 ? items[controlIndex].props.id : undefined;
  const controlId = existingId || generatedId;
  const control = items.map((child, index) => {
    const key = child?.key ?? index;
    return index === controlIndex && isValidElement(child)
      ? cloneElement(child, { id: controlId, key })
      : <React.Fragment key={key}>{child}</React.Fragment>;
  });

  return <div className="field"><label htmlFor={controlIndex >= 0 ? controlId : undefined}>{label}</label>{control}</div>;
}
