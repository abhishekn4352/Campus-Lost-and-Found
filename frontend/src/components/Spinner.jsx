export default function Spinner({ text = 'Loading...' }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      <span className="spinner-txt">{text}</span>
    </div>
  );
}
