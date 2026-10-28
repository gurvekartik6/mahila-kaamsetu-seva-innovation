export default function Stat({ icon, value, label }) { return <div className="stat"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>; }
