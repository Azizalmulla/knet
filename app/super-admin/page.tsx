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
    
    try {
      const res = await fetch('/api/super-admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          slug: formData.get('slug'),
          is_public: formData.get('is_public') === 'on',
          company_code: formData.get('company_code') || null,
          logo_url: formData.get('logo_url') || null
        })
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
        toast.error(error.message || 'Failed to create organization')
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
  
  const handleLogout = () => {
    fetch('/api/super-admin/logout', { method: 'POST' })
    router.push('/super-admin/login')
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-amber-500" />
            <div>
              <h1 className="text-xl font-bold text-white">Super Admin Portal</h1>
              <p className="text-sm text-slate-400">Manage organizations and admins</p>
            </div>
          </div>
          <Button 
            onClick={handleLogout}
            variant="outline" 
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Tabs defaultValue="organizations" className="space-y-4">
          <TabsList className="bg-slate-800">
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
              <h2 className="text-2xl font-bold text-white">Organizations</h2>
              <Dialog open={showNewOrgDialog} onOpenChange={setShowNewOrgDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    New Organization
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-800 text-white border-slate-700">
                  <DialogHeader>
                    <DialogTitle>Create New Organization</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Set up a new organization with admin access
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateOrg} className="space-y-4">
                    <div>
                      <Label htmlFor="name" className="text-slate-200">Organization Name</Label>
                      <Input
                        id="name"
                        name="name"
                        required
                        placeholder="KNET"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="slug" className="text-slate-200">URL Slug</Label>
                      <Input
                        id="slug"
                        name="slug"
                        required
                        pattern="^[a-z0-9-]+$"
                        placeholder="knet"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                      <p className="text-xs text-slate-400 mt-1">Lowercase letters, numbers, and hyphens only</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="is_public" name="is_public" defaultChecked />
                      <Label htmlFor="is_public" className="text-slate-200">Public (visible in picker)</Label>
                    </div>
                    <div>
                      <Label htmlFor="company_code" className="text-slate-200">Company Code (optional)</Label>
                      <Input
                        id="company_code"
                        name="company_code"
                        placeholder="PRIV2024"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                      <p className="text-xs text-slate-400 mt-1">For private access</p>
                    </div>
                    <div>
                      <Label htmlFor="logo_url" className="text-slate-200">Logo URL (optional)</Label>
                      <Input
                        id="logo_url"
                        name="logo_url"
                        placeholder="/images/logos/knet.png"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" className="bg-amber-600 hover:bg-amber-700">
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
              {organizations.map((org) => (
                <Card key={org.id} className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-white">{org.name}</CardTitle>
                        <CardDescription className="text-slate-400">
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
                        <span className="text-sm text-slate-300">AI Builder</span>
                        <Switch
                          checked={org.enable_ai_builder}
                          onCheckedChange={(checked) => toggleFeature(org.id, 'enable_ai_builder', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300">Exports</span>
                        <Switch
                          checked={org.enable_exports}
                          onCheckedChange={(checked) => toggleFeature(org.id, 'enable_exports', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300">Analytics</span>
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
                        className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                        onClick={() => copyLink(org.slug, 'student')}
                      >
                        <Link className="h-3 w-3 mr-1" />
                        Student
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                        onClick={() => copyLink(org.slug, 'admin')}
                      >
                        <Link className="h-3 w-3 mr-1" />
                        Admin
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                        onClick={() => {
                          setSelectedOrg(org)
                          generateQrCode(org.slug)
                        }}
                      >
                        <QrCode className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {/* Manage Admins */}
                    <div className="pt-2 border-t border-slate-700">
                      <Button
                        size="sm"
                        className="w-full bg-slate-700 hover:bg-slate-600"
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
                      <div className="text-xs text-slate-400">
                        Code: {org.company_code}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="audit" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Audit Log</CardTitle>
                <CardDescription className="text-slate-400">
                  Recent super admin actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-slate-400">Audit log implementation pending...</div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* QR Code Modal */}
        {qrCodeUrl && selectedOrg && (
          <Dialog open={!!qrCodeUrl} onOpenChange={() => setQrCodeUrl('')}>
            <DialogContent className="bg-slate-800 text-white border-slate-700">
              <DialogHeader>
                <DialogTitle>QR Code for {selectedOrg.name}</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Students can scan this to access the submission form
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center space-y-4">
                <img src={qrCodeUrl} alt="QR Code" className="bg-white p-4 rounded" />
                <div className="text-sm text-slate-400">
                  {window.location.origin}/{selectedOrg.slug}/start
                </div>
                <Button
                  onClick={() => {
                    const link = document.createElement('a')
                    link.download = `${selectedOrg.slug}-qr.png`
                    link.href = qrCodeUrl
                    link.click()
                  }}
                  className="bg-amber-600 hover:bg-amber-700"
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
          <DialogContent className="bg-slate-800 text-white border-slate-700">
            <DialogHeader>
              <DialogTitle>Invite Admin to {selectedOrg?.name}</DialogTitle>
              <DialogDescription className="text-slate-400">
                Send an invitation to manage this organization
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInviteAdmin} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-slate-200">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="admin@example.com"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label htmlFor="role" className="text-slate-200">Role</Label>
                <select
                  id="role"
                  name="role"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-md"
                >
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="sendEmail" name="sendEmail" />
                <Label htmlFor="sendEmail" className="text-slate-200">Send email notification</Label>
              </div>
              
              {/* Current Admins List */}
              {orgAdmins.length > 0 && (
                <div className="border-t border-slate-700 pt-4">
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Current Admins</h4>
                  <div className="space-y-2">
                    {orgAdmins.map((admin) => (
                      <div key={admin.id} className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">{admin.email}</span>
                        <Badge variant="outline" className="text-slate-400">
                          {admin.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700">
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
