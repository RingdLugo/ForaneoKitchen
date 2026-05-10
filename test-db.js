require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://gikqmtsrhgdxzxvjxcbd.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpa3FtdHNyaGdkeHp4dmp4Y2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzODY4ODAsImV4cCI6MjA5Mzk2Mjg4MH0.ubyw3vO0p2HI56Smn9bG18-lYdrWeSAB_6PVKfP1GX0'
);

async function testConnection() {
  console.log('Probando conexión a Supabase...');
  const { data, error } = await supabase.from('usuarios').select('*').limit(1);
  if (error) {
    console.error('❌ Error de conexión:', error.message);
  } else {
    console.log('✅ Conexión exitosa! Usuarios encontrados:', data.length);
  }
}

testConnection();
