'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar, Clock, CheckCircle2, Video, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface AvailableSlot {
  id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  meeting_link?: string;
  admin_email: string;
  admin_id: string;
}

export default function ScheduleBookingPage() {
  const params = useParams();
  const orgSlug = params?.org as string;

  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<any>(null);

  // Form state
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');
  const [position, setPosition] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAvailableSlots();
  }, [orgSlug]);

  const fetchAvailableSlots = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/${orgSlug}/schedule/book`);
      if (!res.ok) throw new Error('Failed to fetch slots');
      
      const data = await res.json();
      setSlots(data.availableSlots || []);
      setOrgName(data.organization || orgSlug);
    } catch (error: any) {
      toast.error('Failed to load available times');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSlotSelect = (slot: AvailableSlot) => {
    setSelectedSlot(slot);
    setShowBookingForm(true);
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSlot) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/${orgSlug}/schedule/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          availability_id: selectedSlot.id,
          candidate_name: candidateName,
          candidate_email: candidateEmail,
          candidate_phone: candidatePhone,
          position_applying_for: position,
          interview_type: 'general',
          notes: notes,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to book interview');
      }

      const data = await res.json();
      setBookingDetails(data.booking);
      setShowBookingForm(false);
      setShowConfirmation(true);
      fetchAvailableSlots(); // Refresh available slots
      
    } catch (error: any) {
      toast.error(error.message);
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  // Group slots by date
  const groupedSlots = slots.reduce((acc, slot) => {
    const date = new Date(slot.start_time).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {} as Record<string, AvailableSlot[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <CardContent className="p-12 text-center">
              <Clock className="w-12 h-12 animate-spin mx-auto mb-4" />
              <p className="text-lg font-bold">Loading available times...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/${orgSlug}`}>
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-4xl font-black mb-2">Schedule Your Interview</h1>
          <p className="text-xl text-gray-600">
            Book a time to meet with <span className="font-bold">{orgName}</span>
          </p>
        </div>

        {/* Available Slots */}
        {Object.keys(groupedSlots).length === 0 ? (
          <Card className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <CardContent className="p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">No Available Times</h3>
              <p className="text-gray-600">
                There are currently no open interview slots. Please check back later or contact us directly.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedSlots).map(([date, dateSlots]) => (
              <Card key={date} className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader className="bg-purple-100 border-b-4 border-black">
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Calendar className="w-6 h-6" />
                    {date}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dateSlots.map((slot) => (
                      <Button
                        key={slot.id}
                        onClick={() => handleSlotSelect(slot)}
                        className="h-auto p-4 bg-white hover:bg-purple-50 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                        variant="outline"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Clock className="w-5 h-5" />
                          <span className="font-bold text-lg">
                            {new Date(slot.start_time).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="text-sm text-gray-600">
                            {slot.duration_minutes} minutes
                          </span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Booking Form Dialog */}
        <Dialog open={showBookingForm} onOpenChange={setShowBookingForm}>
          <DialogContent className="border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black">Book Interview</DialogTitle>
              <DialogDescription>
                {selectedSlot && (
                  <div className="mt-2 p-3 bg-purple-50 rounded-lg border-2 border-purple-500">
                    <p className="font-bold flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {new Date(selectedSlot.start_time).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="font-bold flex items-center gap-2 mt-1">
                      <Clock className="w-4 h-4" />
                      {new Date(selectedSlot.start_time).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' - '}
                      {new Date(selectedSlot.end_time).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleBooking} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name" className="font-bold">Full Name *</Label>
                <Input
                  id="name"
                  type="text"
                  required
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="border-2 border-black"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="email" className="font-bold">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  className="border-2 border-black"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="font-bold">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={candidatePhone}
                  onChange={(e) => setCandidatePhone(e.target.value)}
                  className="border-2 border-black"
                  placeholder="+965 1234 5678"
                />
              </div>
              <div>
                <Label htmlFor="position" className="font-bold">Position Applying For</Label>
                <Input
                  id="position"
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="border-2 border-black"
                  placeholder="e.g., Software Engineer"
                />
              </div>
              <div>
                <Label htmlFor="notes" className="font-bold">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="border-2 border-black"
                  placeholder="Any questions or special requirements..."
                  rows={3}
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-black text-white hover:bg-gray-800 font-bold text-lg py-6"
              >
                {submitting ? 'Booking...' : 'Confirm Booking'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
          <DialogContent className="border-4 border-green-500 shadow-[12px_12px_0px_0px_rgba(34,197,94,1)] max-w-md">
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-3xl font-black mb-2">Interview Booked!</h2>
              <p className="text-gray-600 mb-6">
                Your interview with <span className="font-bold">{orgName}</span> is confirmed.
              </p>
              
              {bookingDetails && (
                <div className="space-y-4 text-left">
                  <div className="p-4 bg-green-50 rounded-lg border-2 border-green-500">
                    <p className="font-bold flex items-center gap-2 mb-2">
                      <Calendar className="w-5 h-5" />
                      {new Date(bookingDetails.start_time).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="font-bold flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      {new Date(bookingDetails.start_time).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' - '}
                      {new Date(bookingDetails.end_time).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-500">
                    <p className="font-bold flex items-center gap-2 mb-2">
                      <Video className="w-5 h-5" />
                      Meeting Link
                    </p>
                    <a
                      href={bookingDetails.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all text-sm"
                    >
                      {bookingDetails.meeting_link}
                    </a>
                  </div>

                  <p className="text-sm text-gray-600 text-center">
                    We've sent a confirmation email with all the details.
                    You'll receive a reminder 24 hours before your interview.
                  </p>
                </div>
              )}

              <Button
                onClick={() => {
                  setShowConfirmation(false);
                  setSelectedSlot(null);
                  setCandidateName('');
                  setCandidateEmail('');
                  setCandidatePhone('');
                  setPosition('');
                  setNotes('');
                }}
                className="w-full mt-6 bg-black text-white hover:bg-gray-800"
              >
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
