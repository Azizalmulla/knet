'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Video,
  User,
  Mail,
  Phone,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

interface Slot {
  id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  is_booked: boolean;
  meeting_link?: string;
  notes?: string;
  candidate_name?: string;
  candidate_email?: string;
  booking_status?: string;
}

interface InterviewSchedulingProps {
  orgSlug: string;
}

export function InterviewScheduling({ orgSlug }: InterviewSchedulingProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Form state
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [meetingLink, setMeetingLink] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchSlots();
  }, []);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`/api/${orgSlug}/admin/schedule/availability?include_booked=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch slots');

      const data = await res.json();
      setSlots(data.slots || []);
    } catch (error: any) {
      toast.error('Failed to load schedule');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const addSlots = async () => {
    if (!startDate || !startTime) {
      toast.error('Please select date and time');
      return;
    }

    const token = localStorage.getItem('adminToken');
    
    // Generate slots (e.g., 9am-5pm with breaks)
    const slots = [];
    const baseDate = new Date(`${startDate}T${startTime}`);
    
    // Create 8 slots (8 hours with 30-min slots)
    for (let i = 0; i < 8; i++) {
      const start = new Date(baseDate.getTime() + (i * duration * 60 * 1000) + (i * 15 * 60 * 1000)); // 15 min buffer
      const end = new Date(start.getTime() + (duration * 60 * 1000));

      slots.push({
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration_minutes: duration,
        meeting_link: meetingLink || `https://meet.google.com/${orgSlug}-${Date.now()}`,
        notes: notes || null,
      });
    }

    try {
      const res = await fetch(`/api/${orgSlug}/admin/schedule/availability`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slots }),
      });

      if (!res.ok) throw new Error('Failed to create slots');

      toast.success(`Created ${slots.length} availability slots!`);
      setShowAddDialog(false);
      fetchSlots();
      
      // Reset form
      setStartDate('');
      setStartTime('09:00');
      setDuration(30);
      setMeetingLink('');
      setNotes('');
    } catch (error: any) {
      toast.error('Failed to create slots');
      console.error(error);
    }
  };

  const deleteSlot = async (slotId: string) => {
    if (!confirm('Are you sure you want to delete this slot?')) return;

    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`/api/${orgSlug}/admin/schedule/availability?slot_id=${slotId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to delete slot');

      toast.success('Slot deleted');
      fetchSlots();
    } catch (error: any) {
      toast.error('Failed to delete slot');
      console.error(error);
    }
  };

  const copyBookingLink = () => {
    const link = `${window.location.origin}/${orgSlug}/schedule`;
    navigator.clipboard.writeText(link);
    toast.success('Booking link copied to clipboard!');
  };

  const openBookingPage = () => {
    window.open(`/${orgSlug}/schedule`, '_blank');
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
  }, {} as Record<string, Slot[]>);

  const bookedCount = slots.filter(s => s.is_booked).length;
  const availableCount = slots.filter(s => !s.is_booked && new Date(s.start_time) > new Date()).length;

  if (loading) {
    return (
      <Card className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <CardContent className="p-8 text-center">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-lg font-bold">Loading schedule...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black mb-2">Interview Scheduling</h2>
          <p className="text-gray-600">Manage your availability and bookings</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={copyBookingLink}
            variant="outline"
            className="border-2 border-black"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Booking Link
          </Button>
          <Button
            onClick={openBookingPage}
            variant="outline"
            className="border-2 border-black"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View Booking Page
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-black text-white hover:bg-gray-800">
                <Plus className="w-4 h-4 mr-2" />
                Add Availability
              </Button>
            </DialogTrigger>
            <DialogContent className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">Add Availability Slots</DialogTitle>
                <DialogDescription>
                  Create time slots for candidates to book interviews
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="date" className="font-bold">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="border-2 border-black"
                  />
                </div>
                <div>
                  <Label htmlFor="time" className="font-bold">Start Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="border-2 border-black"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Will create 8 slots starting from this time with 15-min breaks
                  </p>
                </div>
                <div>
                  <Label htmlFor="duration" className="font-bold">Duration (minutes)</Label>
                  <select
                    id="duration"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full p-2 border-2 border-black rounded-lg"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="meeting_link" className="font-bold">Meeting Link (optional)</Label>
                  <Input
                    id="meeting_link"
                    type="url"
                    placeholder="https://zoom.us/j/123456789"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    className="border-2 border-black"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Leave blank to auto-generate a Google Meet link
                  </p>
                </div>
                <div>
                  <Label htmlFor="notes" className="font-bold">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any special instructions or requirements..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="border-2 border-black"
                  />
                </div>
                <Button
                  onClick={addSlots}
                  className="w-full bg-black text-white hover:bg-gray-800"
                >
                  Create Slots
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-4 border-green-500 shadow-[4px_4px_0px_0px_rgba(34,197,94,1)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Available Slots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{availableCount}</div>
            <p className="text-sm text-gray-600">Ready to be booked</p>
          </CardContent>
        </Card>

        <Card className="border-4 border-blue-500 shadow-[4px_4px_0px_0px_rgba(59,130,246,1)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Booked Interviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{bookedCount}</div>
            <p className="text-sm text-gray-600">Confirmed bookings</p>
          </CardContent>
        </Card>

        <Card className="border-4 border-purple-500 shadow-[4px_4px_0px_0px_rgba(168,85,247,1)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-500" />
              Total Slots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{slots.length}</div>
            <p className="text-sm text-gray-600">All time slots</p>
          </CardContent>
        </Card>
      </div>

      {/* Slots List */}
      {Object.keys(groupedSlots).length === 0 ? (
        <Card className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <CardContent className="p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No availability set</h3>
            <p className="text-gray-600 mb-4">
              Create your first availability slots to let candidates book interviews
            </p>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-black text-white hover:bg-gray-800"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Availability
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedSlots).map(([date, dateSlots]) => (
            <Card key={date} className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <CardHeader className="bg-gray-50">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {date}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {dateSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className={`p-4 rounded-lg border-2 ${
                        slot.is_booked
                          ? 'border-blue-500 bg-blue-50'
                          : new Date(slot.start_time) < new Date()
                          ? 'border-gray-300 bg-gray-50 opacity-50'
                          : 'border-green-500 bg-green-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Clock className="w-4 h-4" />
                              <span className="font-bold">
                                {new Date(slot.start_time).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                                {' - '}
                                {new Date(slot.end_time).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <Badge className={slot.is_booked ? 'bg-blue-500' : 'bg-green-500'}>
                                {slot.is_booked ? 'Booked' : 'Available'}
                              </Badge>
                            </div>
                            {slot.is_booked && slot.candidate_name && (
                              <div className="flex items-center gap-4 text-sm mt-2">
                                <div className="flex items-center gap-1">
                                  <User className="w-4 h-4" />
                                  <span>{slot.candidate_name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Mail className="w-4 h-4" />
                                  <span>{slot.candidate_email}</span>
                                </div>
                              </div>
                            )}
                            {slot.notes && (
                              <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                                <FileText className="w-4 h-4" />
                                <span>{slot.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {slot.meeting_link && (
                            <Button
                              onClick={() => window.open(slot.meeting_link, '_blank')}
                              size="sm"
                              variant="outline"
                              className="border-2 border-black"
                            >
                              <Video className="w-4 h-4 mr-1" />
                              Join
                            </Button>
                          )}
                          {!slot.is_booked && new Date(slot.start_time) > new Date() && (
                            <Button
                              onClick={() => deleteSlot(slot.id)}
                              size="sm"
                              variant="destructive"
                              className="bg-red-500 hover:bg-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
