
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function checkData() {
  const { data, error } = await supabase.from('recetas').select('*').limit(1).single();
  if (error) {
    console.error('Error fetching recipe:', error);
    return;
  }
  console.log('Recipe data:', JSON.stringify(data, null, 2));
}

checkData();
