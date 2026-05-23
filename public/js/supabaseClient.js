import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://wryxnondbuebynrwpiik.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_339Q8NHn_cOyXEavS1bP7Q_H6Jk6mZS';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
