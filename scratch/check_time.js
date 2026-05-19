const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
  const { data, error } = await supabase.from('recetas').select('titulo, tiempo_numerico').lte('tiempo_numerico', 30);
  console.log('Error:', error);
  console.log('Recetas con tiempo <= 30:', data);
}
check();
