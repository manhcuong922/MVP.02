import { get, ref, update } from 'firebase/database'
import { seedData } from '../data/demoData'
import { database } from './config'

export async function ensureDemoSeed() {
  const [usersSnapshot, tasksSnapshot, historySnapshot] = await Promise.all([
    get(ref(database, 'users')),
    get(ref(database, 'tasks')),
    get(ref(database, 'taskHistory')),
  ])

  const updates = {}

  if (!usersSnapshot.exists()) {
    updates['/users'] = seedData.users
  }

  if (!tasksSnapshot.exists()) {
    updates['/tasks'] = seedData.tasks
  }

  if (!historySnapshot.exists()) {
    updates['/taskHistory'] = seedData.taskHistory
  }

  if (Object.keys(updates).length > 0) {
    await update(ref(database), updates)
    return true
  }

  return false
}

