export default function MinimalCV({ data }: { data: any }) {
  return (
    <div>
      <h1>{data.fullName}</h1>
      <p>{data.email}</p>
    </div>
  );
}
