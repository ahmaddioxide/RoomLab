export default function RangeTabs({ current, onChange, id }) {
  const ranges = ['1h', '6h', '24h', '7d', '30d'];
  return (
    <div className="range-tabs" id={id}>
      {ranges.map(r => (
        <button
          key={r}
          className={`range-tab${current === r ? ' active' : ''}`}
          onClick={() => onChange(r)}
        >
          {r.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
