const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://neqnkbqhzdtqfoxqpgld.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lcW5rYnFoemR0cWZveHFwZ2xkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDc0NTUsImV4cCI6MjA5MjQyMzQ1NX0.5Jb1FUqD1FJZAtPxkaW5Qy5e6X8efauzVJMQTGTNDsg'
);

async function test() {
  console.log('🔍 Probando conexión a Supabase...');
  
  // 1. Probar SELECT
  const { data: users, error: selectError } = await supabase.from('usuarios').select('*').limit(5);
  console.log('✅ SELECT:', users ? `${users.length} usuarios encontrados` : '0 usuarios');
  if (selectError) console.error('❌ SELECT Error:', selectError);
  
  // 2. Probar INSERT
  const testEmail = `test_${Date.now()}@test.com`;
  const testUsername = `test_${Date.now()}`;
  
  const { data: newUser, error: insertError } = await supabase.from('usuarios').insert({
    nombre: 'Test',
    apellido: 'Insert',
    email: testEmail,
    username: testUsername,
    password_hash: 'test123',
    es_premium: false,
    bio: '',
    foto_perfil: null,
    preferencias: []
  }).select();
  
  if (insertError) {
    console.error('❌ INSERT Error:', insertError);
    console.log('📝 Detalles del error:', JSON.stringify(insertError, null, 2));
  } else {
    console.log('✅ INSERT exitoso! ID:', newUser[0]?.id);
  }
}

test();