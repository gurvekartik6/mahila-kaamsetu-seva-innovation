export default function Toast({ message }) { return message ? <div className="toast" role="status" aria-live="polite">{message}</div> : null; }
