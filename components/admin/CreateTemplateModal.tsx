"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { X, Plus, Trash2, Video } from 'lucide-react'
import { toast } from 'sonner'

type Question = {
  text: string
  time_limit: number
}

export default function CreateTemplateModal({
  orgSlug,
  onClose,
  onSuccess
}: {
  orgSlug: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<Question[]>([
    { text: '', time_limit: 120 }
  ])
  const [saving, setSaving] = useState(false)

  const addQuestion = () => {
    setQuestions([...questions, { text: '', time_limit: 120 }])
  }

  const removeQuestion = (index: number) => {
    if (questions.length === 1) {
      toast.error('You need at least one question')
      return
    }
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const updateQuestion = (index: number, field: 'text' | 'time_limit', value: string | number) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    setQuestions(updated)
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Template title is required')
      return
    }

    const validQuestions = questions.filter(q => q.text.trim())
    if (validQuestions.length === 0) {
      toast.error('Add at least one question')
      return
    }

    try {
      setSaving(true)
      const res = await fetch(`/api/${orgSlug}/admin/interview-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          questions: validQuestions.map(q => ({
            question_text: q.text.trim(),
            time_limit_seconds: q.time_limit,
            question_type: 'video'
          }))
        })
      })

      if (!res.ok) throw new Error('Failed to create template')

      toast.success('Interview template created!')
      onSuccess()
    } catch (err) {
      toast.error('Failed to create template')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border-[4px] border-black bg-white shadow-[12px_12px_0_#111]">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b-[3px] border-black p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl border-[3px] border-black bg-[#bde0fe] flex items-center justify-center shadow-[3px_3px_0_#111]">
              <Video className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create Interview Template</h2>
              <p className="text-sm text-gray-600">Set up your video interview questions</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="rounded-xl hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Template Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Template Title *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Software Engineer Interview"
                className="rounded-xl border-[3px] border-black shadow-[3px_3px_0_#111] font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Description (Optional)
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this interview..."
                className="rounded-xl border-[3px] border-black shadow-[3px_3px_0_#111] font-medium min-h-[80px]"
              />
            </div>
          </div>

          {/* Questions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-bold text-gray-900">
                Interview Questions *
              </label>
              <Button
                onClick={addQuestion}
                size="sm"
                className="rounded-xl border-[2px] border-black bg-[#a7f3d0] text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-all font-bold"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Question
              </Button>
            </div>

            <div className="space-y-4">
              {questions.map((q, index) => (
                <div
                  key={index}
                  className="rounded-xl border-[3px] border-black bg-[#e0f2ff] p-4 shadow-[4px_4px_0_#111]"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm font-bold text-gray-900">
                      Question {index + 1}
                    </span>
                    {questions.length > 1 && (
                      <Button
                        onClick={() => removeQuestion(index)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-red-100"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    )}
                  </div>

                  <Textarea
                    value={q.text}
                    onChange={(e) => updateQuestion(index, 'text', e.target.value)}
                    placeholder="What question should the candidate answer?"
                    className="rounded-lg border-[2px] border-black bg-white mb-3 font-medium"
                  />

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-gray-700">
                      Time Limit:
                    </label>
                    <select
                      value={q.time_limit}
                      onChange={(e) => updateQuestion(index, 'time_limit', parseInt(e.target.value))}
                      className="rounded-lg border-[2px] border-black bg-white px-3 py-1 text-sm font-medium"
                    >
                      <option value={60}>1 minute</option>
                      <option value={120}>2 minutes</option>
                      <option value={180}>3 minutes</option>
                      <option value={300}>5 minutes</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t-[3px] border-black p-6 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl border-[3px] border-black bg-white text-gray-700 shadow-[4px_4px_0_#111] hover:-translate-y-0.5 transition-all font-bold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-xl border-[3px] border-black bg-[#bde0fe] text-black shadow-[4px_4px_0_#111] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#111] transition-all font-bold"
          >
            {saving ? 'Creating...' : 'Create Template'}
          </Button>
        </div>
      </div>
    </div>
  )
}
