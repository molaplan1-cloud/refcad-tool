import bcrypt from 'bcryptjs'
import { createUser, findUserByEmail, findUserByLogin } from './db.js'

let seeded = false

async function hash(password) {
  return bcrypt.hash(String(password), 10)
}

export async function ensureSeeded() {
  if (seeded) return
  seeded = true
  try {
    const adminEmail = String(process.env.ADMIN_EMAIL || '').trim()
    const adminPassword = process.env.ADMIN_PASSWORD || ''
    if (adminEmail && adminPassword && !(await findUserByEmail(adminEmail))) {
      await createUser({
        email: adminEmail,
        username: '',
        name: 'Ylläpitäjä',
        passwordHash: await hash(adminPassword),
        role: 'admin',
        plan: 'company',
        payment: 'received',
        disabled: false,
        validFrom: '',
        validUntil: '',
        requestedPlan: '',
        billingCycle: '',
      })
    }
    const demoName = String(process.env.DEMO_USERNAME || '').trim()
    const demoPassword = process.env.DEMO_PASSWORD || ''
    if (demoName && demoPassword && !(await findUserByLogin(demoName))) {
      const email = demoName.includes('@') ? demoName : `${demoName}@demo.refcad.local`
      await createUser({
        email,
        username: demoName,
        name: 'Demo',
        passwordHash: await hash(demoPassword),
        role: 'demo',
        plan: 'pro',
        payment: 'received',
        disabled: false,
        validFrom: '',
        validUntil: '',
        requestedPlan: '',
        billingCycle: '',
      })
    }
  } catch (err) {
    seeded = false
    console.error('Account seed failed')
  }
}
