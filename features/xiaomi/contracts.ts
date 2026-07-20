import { z } from 'zod'

export const createXiaomiAccountSchema = z.object({
  account: z.string().trim().min(1, '账号不能为空').max(128),
  password: z.string().min(1, '密码不能为空').max(128),
  nickname: z.string().trim().max(64).optional(),
})

export const updateXiaomiAccountSchema = z.object({
  nickname: z.string().trim().max(64).optional(),
  status: z.enum(['active', 'error']).optional(),
  account: z.string().trim().min(1).max(128).optional(),
  password: z.string().min(1).max(128).optional(),
}).superRefine((value, context) => {
  if ((value.account === undefined) !== (value.password === undefined)) {
    context.addIssue({ code: 'custom', message: '重新登录时需同时提供账号和密码' })
  }
})
