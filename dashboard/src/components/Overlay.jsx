export default function Overlay({ title, message, showSpinner = true, visible = true }) {
  if (!visible) return null;
  return (
    <div className="overlay">
      <div className="overlay-card">
        {showSpinner && <div className="spinner" />}
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
    </div>
  );
}
