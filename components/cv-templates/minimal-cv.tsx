export default function MinimalCV({ data }: { data: any }) {
  return (
    <div className="cv-root max-w-4xl mx-auto bg-background text-foreground p-6">
      <h1 className="text-2xl font-semibold">{data.fullName}</h1>
      <p className="text-muted-foreground">{data.email}</p>
    </div>
  );
}
