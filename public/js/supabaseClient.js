// supabaseClient.js - Inicialización dinámica para evitar llaves hardcodeadas
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let supabaseClient = null;

// Función para inicializar el cliente obteniendo la config del servidor
async function getSupabase() {
  if (supabaseClient) return supabaseClient;

  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    
    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
      throw new Error('Configuración de Supabase no encontrada en el servidor');
    }

    supabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
    return supabaseClient;
  } catch (err) {
    console.error('Error al cargar la configuración de Supabase:', err);
    // Fallback por si acaso en desarrollo local
    return null;
  }
}

// Exportamos el cliente cargado dinámicamente
export const supabase = await getSupabase();