'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Account {
  id: string
  nickname: string
  status: string
  lastSyncAt: string | null
  lastError: string | null
}

export default function XiaomiPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ account: '', password: '', nickname: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchAccounts() }, [])

  async function fetchAccounts() {
    const res = await fetch('/api/xiaomi')
    if (res.ok) setAccounts(await res.json())
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/xiaomi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      setOpen(false)
      setForm({ account: '', password: '', nickname: '' })
      fetchAccounts()
    } else {
      setError(data.error || '添加失败')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除该账号？')) return
    await fetch(`/api/xiaomi?id=${id}`, { method: 'DELETE' })
    fetchAccounts()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">小米账号</h1>
          <p className="text-muted-foreground">管理你的小米运动账号</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> 添加账号
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加小米账号</DialogTitle>
              <DialogDescription>
                输入你的小米/Zepp 账号和密码
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>小米账号（手机号 / 邮箱）</Label>
                  <Input
                    value={form.account}
                    onChange={(e) => setForm({ ...form, account: e.target.value })}
                    placeholder="手机号或邮箱"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>密码</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="小米账号密码"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>显示名称（可选）</Label>
                  <Input
                    value={form.nickname}
                    onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                    placeholder="给账号起个名字"
                  />
                </div>
                {error && (
                  <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? '添加中...' : '添加'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex h-40 flex-col items-center justify-center text-muted-foreground">
            <Smartphone className="mb-3 h-10 w-10 opacity-30" />
            <p>暂无账号，点击上方按钮添加</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>最后同步</TableHead>
                <TableHead>错误信息</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc) => (
                <TableRow key={acc.id}>
                  <TableCell className="font-medium">{acc.nickname}</TableCell>
                  <TableCell>
                    <Badge variant={acc.status === 'active' ? 'default' : 'destructive'}>
                      {acc.status === 'active' ? '正常' : '异常'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {acc.lastSyncAt ? new Date(acc.lastSyncAt).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {acc.lastError || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(acc.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
