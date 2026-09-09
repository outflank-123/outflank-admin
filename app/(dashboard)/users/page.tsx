'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Users, ShieldAlert, CheckCircle2, XCircle, Trash2, Edit2 } from 'lucide-react'

interface User {
  id: string
  email: string
  full_name: string
  role: string
  created_at: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)

  // Form State
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('junior')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
      }
    } catch (err) {
      console.error('Failed to fetch users', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const openCreateModal = () => {
    setEditingUserId(null)
    setEmail('')
    setPassword('')
    setFullName('')
    setRole('junior')
    setError('')
    setSuccess('')
    setIsModalOpen(true)
  }

  const openEditModal = (u: User) => {
    setEditingUserId(u.id)
    setEmail(u.email) // Email cannot typically be updated directly without confirmation, we'll keep it read-only in edit mode
    setPassword('')
    setFullName(u.full_name)
    setRole(u.role)
    setError('')
    setSuccess('')
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This cannot be undone.`)) return

    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete user')
      fetchUsers()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      let res;
      if (editingUserId) {
        // Edit User
        res = await fetch('/api/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingUserId, fullName, role }),
        })
      } else {
        // Create User
        res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, fullName, role }),
        })
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save user')
      }

      setSuccess(editingUserId ? 'User updated successfully!' : 'User created successfully!')
      fetchUsers()
      
      setTimeout(() => setIsModalOpen(false), 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f] tracking-tight flex items-center gap-2">
            <Users size={24} className="text-[#e3231c]" /> User Management
          </h1>
          <p className="text-sm text-[#6e6e73] mt-1">Manage system administrators and junior staff</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-[#1d1d1f] text-white px-4 py-2.5 rounded-full text-sm font-semibold hover:bg-black transition-colors"
        >
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-black/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#6e6e73]">Loading users...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/5 bg-[#f5f5f7]/50">
                <th className="px-6 py-4 text-xs font-semibold text-[#6e6e73] uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-xs font-semibold text-[#6e6e73] uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-xs font-semibold text-[#6e6e73] uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4 text-xs font-semibold text-[#6e6e73] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-black/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-[#1d1d1f]">{u.full_name}</div>
                    <div className="text-sm text-[#6e6e73]">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider
                      ${u.role === 'super_admin' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                        u.role === 'admin' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                        'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}
                    >
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#6e6e73]">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openEditModal(u)}
                        className="text-[#6e6e73] hover:text-[#1d1d1f] transition-colors p-1"
                        title="Edit User"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(u.id, u.full_name)}
                        className="text-[#6e6e73] hover:text-[#e3231c] transition-colors p-1"
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative"
          >
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-black/40 hover:text-black transition-colors"
            >
              <XCircle size={24} />
            </button>
            <h2 className="text-xl font-bold text-[#1d1d1f] mb-6">
              {editingUserId ? 'Edit User' : 'Add New User'}
            </h2>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#6e6e73] uppercase tracking-wider mb-1.5">Full Name</label>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-black/10 focus:outline-none focus:border-[#e3231c]" />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-[#6e6e73] uppercase tracking-wider mb-1.5">Email</label>
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  disabled={!!editingUserId}
                  className="w-full px-4 py-2.5 rounded-xl border border-black/10 focus:outline-none focus:border-[#e3231c] disabled:bg-gray-50 disabled:text-gray-500" 
                />
              </div>

              {!editingUserId && (
                <div>
                  <label className="block text-xs font-semibold text-[#6e6e73] uppercase tracking-wider mb-1.5">Temporary Password</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-black/10 focus:outline-none focus:border-[#e3231c]" />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#6e6e73] uppercase tracking-wider mb-1.5">Role</label>
                <select value={role} onChange={e => setRole(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-black/10 focus:outline-none focus:border-[#e3231c] bg-white">
                  <option value="junior">Junior (Limited Access)</option>
                  <option value="admin">Admin (Full Access, Cannot Create Users)</option>
                  <option value="super_admin">Super Admin (Unrestricted)</option>
                </select>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
                  <ShieldAlert size={16} /> {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                  <CheckCircle2 size={16} /> {success}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-4 w-full bg-[#e3231c] text-white py-3 rounded-xl font-semibold hover:bg-[#c91d17] transition-colors disabled:opacity-50"
              >
                {submitting ? 'Saving...' : (editingUserId ? 'Save Changes' : 'Create User')}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
