"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { 
  Building2, Users, Plus, Settings, LogOut, Shield, QrCode, 
  Link, Copy, Check, X, Edit, Trash2, Eye, EyeOff, Mail,
  Download, RefreshCw
} from 'lucide-react'
import QRCode from 'qrcode'

interface Organization {
  id: string
  name: string
  slug: string
  is_public: boolean
  company_code: string | null
  logo_url: string | null
  enable_ai_builder: boolean
  enable_exports: boolean
  enable_analytics: boolean
  created_at: string
  admin_count?: number
}

interface AdminUser {
  id: string
  email: string
  role: string
  created_at: string
  last_login: string | null
}

export default function SuperAdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [orgAdmins, setOrgAdmins] = useState<AdminUser[]>([])
  const [showNewOrgDialog, setShowNewOrgDialog] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  // Audit tab state
  const [auditEvents, setAuditEvents] = useState<Array<{ timestamp: string; action: string; org_id?: string | null; org_slug?: string | null; payload?: any }>>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const fetchAudit = async () => {
    setAuditLoading(true)
    try {
      const res = await fetch('/api/super-admin/audit?limit=50')
      if (res.ok) {
        const data = await res.json()
        setAuditEvents(Array.isArray(data?.events) ? data.events : [])
      }
    } catch {}
    finally { setAuditLoading(false) }
  }
  
  useEffect(() => {
    checkAuth()
    fetchOrganizations()
  }, [])
  
  const checkAuth = async () => {
    try {
      const res = await fetch('/api/super-admin/verify')
      if (!res.ok) {
        router.push('/super-admin/login')
      }
    } catch {
      router.push('/super-admin/login')
    }
  }
  
  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/super-admin/organizations')
      if (res.ok) {
        const data = await res.json()
        setOrganizations(data.organizations)
      }
    } catch (error) {
      toast.error('Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }
  
  const fetchOrgAdmins = async (orgId: string) => {
    try {
      const res = await fetch(`/api/super-admin/organizations/${orgId}/admins`)
      if (res.ok) {
        const data = await res.json()
        setOrgAdmins(data.admins)
      }
    } catch (error) {
      toast.error('Failed to load admins')
    }
  }
  
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    
    const payload = {
      name: formData.get('name'),
      slug: formData.get('slug'),
      is_public: formData.get('is_public') === 'on',
      company_code: formData.get('company_code') || null,
      logo_url: formData.get('logo_url') || null
    }
    
    console.log('[CREATE ORG] Sending payload:', payload)
    
    try {
      const res = await fetch('/api/super-admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (res.ok) {
        const data = await res.json()
        toast.success(`Organization "${data.organization.name}" created!`)
        setShowNewOrgDialog(false)
        fetchOrganizations()
        
        // Generate QR code for the new org
        generateQrCode(data.organization.slug)
      } else {
        const error = await res.json()
        console.error('[CREATE ORG] Error response:', error)
        toast.error(error.error || error.message || 'Failed to create organization')
      }
    } catch (error) {
      toast.error('Network error')
    }
  }
  
  const handleInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrg) return
    
    const formData = new FormData(e.target as HTMLFormElement)
    
    try {
      const res = await fetch(`/api/super-admin/organizations/${selectedOrg.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.get('email'),
          role: formData.get('role') || 'admin',
          sendEmail: formData.get('sendEmail') === 'on'
        })
      })
      
      if (res.ok) {
        const data = await res.json()
        toast.success('Admin invited successfully!')
        
        // Copy invite link to clipboard
        const inviteUrl = `${window.location.origin}/${selectedOrg.slug}/admin/accept-invite?token=${data.token}`
        navigator.clipboard.writeText(inviteUrl)
        toast.info('Invite link copied to clipboard!')
        
        setShowInviteDialog(false)
        fetchOrgAdmins(selectedOrg.id)
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to invite admin')
      }
    } catch (error) {
      toast.error('Network error')
    }
  }
  
  const toggleFeature = async (orgId: string, feature: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/super-admin/organizations/${orgId}/features`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [feature]: enabled })
      })
      
      if (res.ok) {
        toast.success('Feature updated')
        fetchOrganizations()
      }
    } catch (error) {
      toast.error('Failed to update feature')
    }
  }
  
  const generateQrCode = async (slug: string) => {
    const url = `${window.location.origin}/${slug}/start`
    const qr = await QRCode.toDataURL(url, { width: 256 })
    setQrCodeUrl(qr)
  }
  
  const copyLink = (slug: string, type: 'student' | 'admin') => {
    const url = type === 'student' 
      ? `${window.location.origin}/${slug}/start`
      : `${window.location.origin}/${slug}/admin/login`
    navigator.clipboard.writeText(url)
    toast.success(`${type === 'student' ? 'Student' : 'Admin'} link copied!`)
  }

  const handleDeleteOrg = async (org: Organization) => {
    try {
      const ok = window.confirm(`Delete organization "${org.name}"? This will hide it from students and disable features. You can re-create it later with the same name, but the slug will be archived.`)
      if (!ok) return
      const res = await fetch(`/api/super-admin/organizations/${org.id}?mode=soft`, {
        method: 'DELETE',
      })
      const j = await res.json().catch(() => ({} as any))
      if (res.ok && j?.success) {
        toast.success('Organization deleted')
        fetchOrganizations()
      } else {
        toast.error(j?.error || 'Failed to delete organization')
      }
    } catch (e) {
      toast.error('Network error')
    }
  }
  
  const handleLogout = () => {
    fetch('/api/super-admin/logout', { method: 'POST' })
    router.push('/super-admin/login')
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#eeeee4] text-neutral-900 flex items-center justify-center">
        <div className="animate-pulse text-neutral-600">Loading...</div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-[#eeeee4] text-neutral-900">
      {/* Header */}
      <div className="border-b-[4px] border-black bg-white shadow-[8px_8px_0_#111]">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-amber-500" />
            <div>
              <h1 className="text-xl font-bold text-black">Super Admin Portal</h1>
              <p className="text-sm text-neutral-600">Manage organizations and admins</p>
            </div>
          </div>
          <Button 
            onClick={handleLogout}
            variant="outline" 
            className="rounded-2xl border-[3px] border-black text-black bg-white hover:-translate-y-0.5 hover:bg-neutral-100 shadow-[6px_6px_0_#111] transition-transform"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Tabs defaultValue="organizations" className="space-y-4">
          <TabsList className="bg-white border-[3px] border-black rounded-2xl shadow-[6px_6px_0_#111]">
            <TabsTrigger value="organizations">
              <Building2 className="h-4 w-4 mr-2" />
              Organizations
            </TabsTrigger>
            <TabsTrigger value="audit">
              <Shield className="h-4 w-4 mr-2" />
              Audit Log
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="organizations" className="space-y-4">
            {/* Actions Bar */}
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-black">Organizations</h2>
              <Dialog open={showNewOrgDialog} onOpenChange={setShowNewOrgDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    New Organization
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white text-neutral-900 border-black border-[3px] rounded-2xl shadow-[6px_6px_0_#111]">
                  <DialogHeader>
                    <DialogTitle>Create New Organization</DialogTitle>
                    <DialogDescription className="text-neutral-600">
                      Set up a new organization with admin access
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateOrg} className="space-y-4">
                    <div>
                      <Label htmlFor="name" className="text-neutral-800">Organization Name</Label>
                      <Input
                        id="name"
                        name="name"
                        required
                        placeholder="Organization Inc."
                        className="bg-white border-[3px] border-black text-black rounded-2xl"
                      />
                    </div>
                    <div>
                      <Label htmlFor="slug" className="text-neutral-800">URL Slug</Label>
                      <Input
                        id="slug"
                        name="slug"
                        required
                        pattern="^[a-z0-9\-]+$"
                        placeholder="acme"
                        className="bg-white border-[3px] border-black text-black rounded-2xl"
                      />
                      <p className="text-xs text-neutral-600 mt-1">Lowercase letters, numbers, and hyphens only</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="is_public" name="is_public" defaultChecked />
                      <Label htmlFor="is_public" className="text-neutral-800">Public (visible in picker)</Label>
                    </div>
                    <div>
                      <Label htmlFor="company_code" className="text-neutral-800">Company Code (optional)</Label>
                      <Input
                        id="company_code"
                        name="company_code"
                        placeholder="PRIV2024"
                        className="bg-white border-[3px] border-black text-black rounded-2xl"
                      />
                      <p className="text-xs text-neutral-600 mt-1">For private access</p>
                    </div>
                    <div>
                      <Label htmlFor="logo_url" className="text-neutral-800">Logo URL (optional)</Label>
                      <Input
                        id="logo_url"
                        name="logo_url"
                        placeholder="/images/logos/company.png"
                        className="bg-white border-[3px] border-black text-black rounded-2xl"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white">
                        Create Organization
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setShowNewOrgDialog(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            
            {/* Organizations Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {organizations.filter((o) => !o.slug?.startsWith('deleted-')).map((org) => (
                <Card key={org.id} className="bg-white border-black border-[3px] rounded-2xl shadow-[6px_6px_0_#111]">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-black">{org.name}</CardTitle>
                        <CardDescription className="text-neutral-600">
                          /{org.slug}
                        </CardDescription>
                      </div>
                      <Badge variant={org.is_public ? "default" : "secondary"}>
                        {org.is_public ? 'Public' : 'Private'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Feature Toggles */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-700">AI Builder</span>
                        <Switch
                          checked={org.enable_ai_builder}
                          onCheckedChange={(checked) => toggleFeature(org.id, 'enable_ai_builder', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-700">Exports</span>
                        <Switch
                          checked={org.enable_exports}
                          onCheckedChange={(checked) => toggleFeature(org.id, 'enable_exports', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-700">Analytics</span>
                        <Switch
                          checked={org.enable_analytics}
                          onCheckedChange={(checked) => toggleFeature(org.id, 'enable_analytics', checked)}
                        />
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 rounded-2xl border-[3px] border-black text-black hover:bg-neutral-100 shadow-[4px_4px_0_#111]"
                        onClick={() => copyLink(org.slug, 'student')}
                      >
                        <Link className="h-3 w-3 mr-1" />
                        Student
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 rounded-2xl border-[3px] border-black text-black hover:bg-neutral-100 shadow-[4px_4px_0_#111]"
                        onClick={() => copyLink(org.slug, 'admin')}
                      >
                        <Link className="h-3 w-3 mr-1" />
                        Admin
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-2xl border-[3px] border-black text-black hover:bg-neutral-100 shadow-[4px_4px_0_#111]"
                        onClick={() => {
                          setSelectedOrg(org)
                          generateQrCode(org.slug)
                        }}
                      >
                        <QrCode className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => handleDeleteOrg(org)}
                        title="Delete organization"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {/* Manage Admins */}
                    <div className="pt-2 border-t border-black">
                      <Button
                        size="sm"
                        className="w-full bg-white text-black border-[3px] border-black rounded-2xl shadow-[6px_6px_0_#111] hover:-translate-y-0.5 hover:bg-neutral-100"
                        onClick={() => {
                          setSelectedOrg(org)
                          setShowInviteDialog(true)
                          fetchOrgAdmins(org.id)
                        }}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Manage Admins ({org.admin_count || 0})
                      </Button>
                    </div>
                    
                    {org.company_code && (
                      <div className="text-xs text-neutral-600">
                        Code: {org.company_code}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="audit" className="space-y-4">
            <Card className="bg-white border-black border-[3px] rounded-2xl shadow-[6px_6px_0_#111]">
              <CardHeader>
                <CardTitle className="text-black">Audit Log</CardTitle>
                <CardDescription className="text-neutral-600">
                  Recent super admin actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-neutral-600">{auditLoading ? 'Loading…' : `Events: ${auditEvents.length}`}</div>
                  <Button variant="outline" size="sm" onClick={fetchAudit}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                  </Button>
                </div>
                {auditEvents.length === 0 ? (
                  <div className="text-neutral-600">No events yet.</div>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-neutral-600">
                          <th className="py-1 pr-4">Time</th>
                          <th className="py-1 pr-4">Action</th>
                          <th className="py-1 pr-4">Org</th>
                          <th className="py-1">Payload</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditEvents.map((e, idx) => (
                          <tr key={idx} className="border-t border-black">
                            <td className="py-1 pr-4">{new Date(e.timestamp).toLocaleString()}</td>
                            <td className="py-1 pr-4">{e.action}</td>
                            <td className="py-1 pr-4">{e.org_slug || e.org_id || '—'}</td>
                            <td className="py-1 whitespace-pre-wrap">{typeof e.payload === 'object' ? JSON.stringify(e.payload) : String(e.payload || '')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* QR Code Modal */}
        {qrCodeUrl && selectedOrg && (
          <Dialog open={!!qrCodeUrl} onOpenChange={() => setQrCodeUrl('')}>
            <DialogContent className="bg-white text-neutral-900 border-black border-[3px] rounded-2xl shadow-[6px_6px_0_#111]">
              <DialogHeader>
                <DialogTitle>QR Code for {selectedOrg.name}</DialogTitle>
                <DialogDescription className="text-neutral-600">
                  Students can scan this to access the submission form
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center space-y-4">
                <img src={qrCodeUrl} alt="QR Code" className="bg-white p-4 rounded" />
                <div className="text-sm text-neutral-600">
                  {window.location.origin}/{selectedOrg.slug}/start
                </div>
                <Button
                  onClick={() => {
                    const link = document.createElement('a')
                    link.download = `${selectedOrg.slug}-qr.png`
                    link.href = qrCodeUrl
                    link.click()
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Code
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        
        {/* Invite Admin Dialog */}
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogContent className="bg-white text-neutral-900 border-black border-[3px] rounded-2xl shadow-[6px_6px_0_#111]">
            <DialogHeader>
              <DialogTitle>Invite Admin to {selectedOrg?.name}</DialogTitle>
              <DialogDescription className="text-neutral-600">
                Send an invitation to manage this organization
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInviteAdmin} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-neutral-800">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="admin@example.com"
                  className="bg-white border-[3px] border-black text-black rounded-2xl"
                />
              </div>
              <div>
                <Label htmlFor="role" className="text-neutral-800">Role</Label>
                <select
                  id="role"
                  name="role"
                  className="w-full px-3 py-2 bg-white border-[3px] border-black text-black rounded-md"
                >
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="sendEmail" name="sendEmail" />
                <Label htmlFor="sendEmail" className="text-neutral-800">Send email notification</Label>
              </div>
              
              {/* Current Admins List */}
              {orgAdmins.length > 0 && (
                <div className="border-t border-black pt-4">
                  <h4 className="text-sm font-medium text-neutral-700 mb-2">Current Admins</h4>
                  <div className="space-y-2">
                    {orgAdmins.map((admin) => (
                      <div key={admin.id} className="flex justify-between items-center text-sm">
                        <span className="text-neutral-600">{admin.email}</span>
                        <Badge variant="outline" className="text-neutral-600">
                          {admin.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white">
                  Send Invitation
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowInviteDialog(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
