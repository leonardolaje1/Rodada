import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Configuración incompleta de Supabase. ' +
    'Verifica VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el archivo .env.local.'
  )
}

if (!supabaseUrl.startsWith('https://')) {
  throw new Error(
    'VITE_SUPABASE_URL no parece ser una URL válida de Supabase.'
  )
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)
