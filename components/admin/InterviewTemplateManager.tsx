"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Video, Plus, Users, Clock, Trash2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import CreateTemplateModal from './CreateTemplateModal'
import InviteCandidatesModal from './InviteCandidatesModal'

type Template = {
  id: string
  title: string
  description: string
  status: string
  created_at: string
  question_count: number
  session_count: number
}

export default function InterviewTemplateManager({ orgSlug }: { orgSlug: string }) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/${orgSlug}/admin/interview-templates`)
      
      if (!res.ok) throw new Error('Failed to fetch templates')
      
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch (err) {
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (orgSlug) fetchTemplates()
  }, [orgSlug])

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure? This will archive the template if it has been used.')) return

    try {
      const res = await fetch(`/api/${orgSlug}/admin/interview-templates/${templateId}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Failed to delete')

      toast.success('Template deleted')
      fetchTemplates()
    } catch (err) {
      toast.error('Failed to delete template')
    }
  }

  const handleInvite = (template: Template) => {
    setSelectedTemplate(template)
    setShowInviteModal(true)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="animate-pulse rounded-2xl border-[3px] border-black bg-white p-6 shadow-[6px_6px_0_#111]">
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Interview Templates</h2>
          <p className="text-gray-600 mt-1">Create and manage video interview question sets</p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="rounded-2xl border-[3px] border-black bg-[#bde0fe] text-black shadow-[4px_4px_0_#111] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#111] transition-all font-bold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Templates List */}
      {templates.length === 0 ? (
        <div className="rounded-2xl border-[3px] border-dashed border-black bg-white p-12 text-center shadow-[6px_6px_0_#111]">
          <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">No Interview Templates</h3>
          <p className="text-gray-600 mb-4">
            Create your first interview template to start inviting candidates
          </p>
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="rounded-2xl border-[3px] border-black bg-[#bde0fe] text-black shadow-[4px_4px_0_#111] hover:-translate-y-0.5 transition-all font-bold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-2xl border-[3px] border-black bg-white p-6 shadow-[6px_6px_0_#111] hover:shadow-[8px_8px_0_#111] hover:-translate-y-1 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {template.title}
                  </h3>
                  {template.description && (
                    <p className="text-sm text-gray-600 mb-3">
                      {template.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      <span className="font-semibold">{template.question_count}</span> questions
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span className="font-semibold">{template.session_count}</span> interviews sent
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {new Date(template.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                {template.status === 'archived' && (
                  <span className="px-3 py-1 rounded-xl border-[2px] border-black bg-gray-200 text-gray-700 text-xs font-bold shadow-[3px_3px_0_#111]">
                    Archived
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleInvite(template)}
                  className="rounded-2xl border-[3px] border-black bg-[#a7f3d0] text-black shadow-[4px_4px_0_#111] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#111] transition-all font-bold"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Invite Candidates
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => handleDelete(template.id)}
                  className="rounded-2xl border-[3px] border-black bg-white text-gray-700 shadow-[4px_4px_0_#111] hover:-translate-y-0.5 hover:bg-gray-100 transition-all font-bold"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateTemplateModal
          orgSlug={orgSlug}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            fetchTemplates()
          }}
        />
      )}

      {showInviteModal && selectedTemplate && (
        <InviteCandidatesModal
          orgSlug={orgSlug}
          template={selectedTemplate}
          onClose={() => {
            setShowInviteModal(false)
            setSelectedTemplate(null)
          }}
          onSuccess={() => {
            setShowInviteModal(false)
            setSelectedTemplate(null)
            fetchTemplates()
          }}
        />
      )}
    </div>
  )
}
