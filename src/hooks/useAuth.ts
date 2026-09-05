import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        signInAnonymously()
      } else {
        handleUser(session.user)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        handleUser(session.user)
      } else {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleUser = async (user: User) => {
    setUser(user)
    
    // Ensure profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (!existingProfile) {
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert([{ id: user.id, name: 'Player' }])
        .select()
        .single()
      setProfile(newProfile)
    } else {
      setProfile(existingProfile)
    }
    
    setLoading(false)
  }

  const signInAnonymously = async () => {
    const { data, error } = await supabase.auth.signInAnonymously()

    if (error) {
      console.error('Anonymous auth error:', error)
      setLoading(false)
    }
  }

  return { user, profile, loading }
}
