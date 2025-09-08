'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { careerMap } from '@/lib/career-map';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, CheckCircle } from 'lucide-react';

const uploadSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(1, 'Phone is required'),
  fieldOfStudy: z.string().min(1, 'Field of study is required'),
  areaOfInterest: z.string().min(1, 'Area of interest is required'),
  cv: z.instanceof(FileList).refine(files => files.length > 0, 'CV file is required')
    .refine(files => files[0]?.type === 'application/pdf', 'Only PDF files are allowed'),
});

type UploadFormData = z.infer<typeof uploadSchema>;

export default function UploadCVForm() {
  const [vacancies, setVacancies] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
  });

  const fieldOfStudy = watch('fieldOfStudy');
  const areaOfInterest = watch('areaOfInterest');

  const onSubmit = async (data: UploadFormData) => {
    setIsSubmitting(true);
    try {
      // Upload CV to blob
      const formData = new FormData();
      formData.append('file', data.cv[0]);
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) {
        throw new Error('Upload failed');
      }
      const { url } = await uploadRes.json();

      // Insert to DB
      const submitRes = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          fieldOfStudy: data.fieldOfStudy,
          areaOfInterest: data.areaOfInterest,
          cvUrl: url,
          cvType: 'uploaded',
        }),
      });
      if (!submitRes.ok) {
        throw new Error('Submission failed');
      }

      // Match vacancies
      const fieldData = careerMap[fieldOfStudy as keyof typeof careerMap];
      if (fieldData && fieldData[areaOfInterest as keyof typeof fieldData]) {
        setVacancies(fieldData[areaOfInterest as keyof typeof fieldData]);
      } else {
        setVacancies([]);
      }

      setIsSuccess(true);
    } catch (error) {
      console.error('Submission error:', error);
      alert('Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">CV Uploaded Successfully!</h2>
          <p className="text-gray-600 mb-6">Your CV has been submitted to KNET.</p>
          
          {vacancies.length > 0 && (
            <div className="text-left">
              <h3 className="font-semibold mb-3">Suggested Vacancies:</h3>
              <ul className="space-y-2">
                {vacancies.map(vacancy => (
                  <li key={vacancy} className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                    {vacancy}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <Button asChild className="mt-6">
            <a href="/start">Back to Dashboard</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Your CV
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                {...register('fullName')}
                placeholder="John Doe"
              />
              {errors.fullName && (
                <p className="text-sm text-red-500 mt-1">{errors.fullName.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="john@example.com"
              />
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              {...register('phone')}
              placeholder="+965 1234 5678"
            />
            {errors.phone && (
              <p className="text-sm text-red-500 mt-1">{errors.phone.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fieldOfStudy">Field of Study *</Label>
              <Select onValueChange={(value) => setValue('fieldOfStudy', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(careerMap).map(field => (
                    <SelectItem key={field} value={field}>{field}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fieldOfStudy && (
                <p className="text-sm text-red-500 mt-1">{errors.fieldOfStudy.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="areaOfInterest">Area of Interest *</Label>
              <Select 
                onValueChange={(value) => setValue('areaOfInterest', value)}
                disabled={!fieldOfStudy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select interest" />
                </SelectTrigger>
                <SelectContent>
                  {fieldOfStudy && careerMap[fieldOfStudy as keyof typeof careerMap] &&
                    Object.keys(careerMap[fieldOfStudy as keyof typeof careerMap]).map(area => (
                      <SelectItem key={area} value={area}>{area}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {errors.areaOfInterest && (
                <p className="text-sm text-red-500 mt-1">{errors.areaOfInterest.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="cv">CV Upload (PDF) *</Label>
            <Input
              id="cv"
              type="file"
              accept=".pdf"
              {...register('cv')}
              className="cursor-pointer"
            />
            {errors.cv && (
              <p className="text-sm text-red-500 mt-1">{errors.cv.message}</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Uploading...' : 'Submit CV'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
