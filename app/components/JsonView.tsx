export default function JsonView({ data }: { data?: unknown }): JSX.Element {
  if (!data) {
    return <p className="muted">Belum ada data.</p>;
  }
  return (
    <pre className="json-viewer">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}