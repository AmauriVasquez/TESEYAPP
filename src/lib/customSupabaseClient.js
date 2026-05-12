import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://czbmqzimjlwwgcglubey.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6Ym1xemltamx3d2djZ2x1YmV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3ODM1NzQsImV4cCI6MjA3ODM1OTU3NH0.76ayYwDksTXvcg7b7n6ltrS6sXx_m7qHkPHHG2hCwyg';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
