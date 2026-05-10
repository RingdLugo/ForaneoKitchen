import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://gikqmtsrhgdxzxvjxcbd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpa3FtdHNyaGdkeHp4dmp4Y2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzODY4ODAsImV4cCI6MjA5Mzk2Mjg4MH0.ubyw3vO0p2HI56Smn9bG18-lYdrWeSAB_6PVKfP1GX0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);