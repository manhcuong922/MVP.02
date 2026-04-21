import { getApp, getApps, initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

export const firebaseConfig = {
  apiKey: 'AIzaSyAhadcf6vuH18MvFblv7RZd4El2PBI3uNI',
  authDomain: 'tiengviet-68b03.firebaseapp.com',
  databaseURL: 'https://tiengviet-68b03-default-rtdb.firebaseio.com',
  projectId: 'tiengviet-68b03',
  storageBucket: 'tiengviet-68b03.firebasestorage.app',
  messagingSenderId: '901659181225',
  appId: '1:901659181225:web:9c1bed3b58d6126d9569b8',
  measurementId: 'G-QYE16DMQ2N',
}

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const database = getDatabase(firebaseApp)

