import { z } from 'zod'

export const uuidSchema = z.string().uuid('ID 格式无效')
const stepSchema = z.coerce.number().int('步数必须为整数').min(1, '步数必须为正整数').max(200000, '步数不能超过 200000')

export const createScheduleSchema = z.object({
  xiaomiAccountId: uuidSchema,
  cronExpression: z.string().trim().min(1, 'Cron 表达式不能为空').max(128),
  minStep: stepSchema,
  maxStep: stepSchema,
}).refine((value) => value.minStep <= value.maxStep, {
  message: '最小步数不能大于最大步数',
  path: ['maxStep'],
})

export const updateScheduleSchema = z.object({
  xiaomiAccountId: uuidSchema.optional(),
  cronExpression: z.string().trim().min(1, 'Cron 表达式不能为空').max(128).optional(),
  minStep: stepSchema.optional(),
  maxStep: stepSchema.optional(),
  isActive: z.boolean('isActive 必须为布尔值').optional(),
}).superRefine((value, context) => {
  const hasMin = value.minStep !== undefined
  const hasMax = value.maxStep !== undefined
  if (hasMin !== hasMax) {
    context.addIssue({
      code: 'custom',
      message: '需同时提供最小和最大步数',
      path: ['minStep'],
    })
  } else if (hasMin && hasMax && value.minStep! > value.maxStep!) {
    context.addIssue({
      code: 'custom',
      message: '最小步数不能大于最大步数',
      path: ['maxStep'],
    })
  }
})

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

export function validationMessage(error: z.ZodError): string {
  return error.issues[0]?.message || '请求参数无效'
}
