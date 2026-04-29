import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://neqnkbqhzdtqfoxqpgld.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lcW5rYnFoemR0cWZveHFwZ2xkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDc0NTUsImV4cCI6MjA5MjQyMzQ1NX0.5Jb1FUqD1FJZAtPxkaW5Qy5e6X8efauzVJMQTGTNDsg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);