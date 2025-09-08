import UploadCVForm from '@/components/upload-cv-form';

export default function UploadPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Upload Your CV</h1>
          <p className="text-gray-600">Upload your existing CV and we'll suggest relevant vacancies based on your field of study and interests.</p>
        </div>
        <UploadCVForm />
      </div>
    </div>
  );
}
