-- ==========================================
-- 0. ELIMINAR TABLAS EXISTENTES (RESET)
-- ==========================================
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
DROP TABLE IF EXISTS public.precios_ingredientes CASCADE;
DROP TABLE IF EXISTS public.lista_compras CASCADE;
DROP TABLE IF EXISTS public.planes_semanales CASCADE;
DROP TABLE IF EXISTS public.historial CASCADE;
DROP TABLE IF EXISTS public.puntos_log CASCADE;
DROP TABLE IF EXISTS public.otp_tokens CASCADE;
DROP TABLE IF EXISTS public.notificaciones CASCADE;
DROP TABLE IF EXISTS public.favoritos CASCADE;
DROP TABLE IF EXISTS public.likes CASCADE;
DROP TABLE IF EXISTS public.comentarios CASCADE;
DROP TABLE IF EXISTS public.metodos_pago CASCADE;
DROP TABLE IF EXISTS public.recetas CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;

-- ==========================================
-- 1. EXTENSIONES NECESARIAS
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 2. TABLA DE USUARIOS
-- ==========================================
CREATE TABLE public.usuarios (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nombre character varying NOT NULL,
  apellido character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  username character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  rol character varying DEFAULT 'free'::character varying CHECK (rol::text = ANY (ARRAY['free'::character varying, 'premium'::character varying, 'admin'::character varying]::text[])),
  es_premium boolean DEFAULT false,
  premium_hasta timestamp with time zone,
  premium_cancelado boolean DEFAULT false,
  puntos integer DEFAULT 0,
  bio text DEFAULT ''::text,
  foto_perfil text,
  preferencias jsonb DEFAULT '[]'::jsonb,
  fecha_registro timestamp with time zone DEFAULT now(),
  ultimo_acceso timestamp with time zone,
  CONSTRAINT usuarios_pkey PRIMARY KEY (id)
);

-- ==========================================
-- 3. TABLA DE RECETAS
-- ==========================================
CREATE TABLE public.recetas (
  id SERIAL PRIMARY KEY,
  titulo character varying NOT NULL,
  descripcion text DEFAULT ''::text,
  ingredientes text NOT NULL,
  pasos text NOT NULL,
  precio character varying DEFAULT '$$'::character varying,
  precio_numerico numeric DEFAULT 0,
  tiempo character varying DEFAULT '30 min'::character varying,
  tiempo_numerico integer DEFAULT 30,
  imagen text,
  video_url text,
  video_youtube text,
  es_premium boolean DEFAULT false,
  etiquetas jsonb DEFAULT '[]'::jsonb,
  autor character varying,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  likes integer DEFAULT 0,
  comentarios_count integer DEFAULT 0,
  fecha timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 4. TABLA DE COMENTARIOS
-- ==========================================
CREATE TABLE public.comentarios (
  id SERIAL PRIMARY KEY,
  receta_id integer REFERENCES public.recetas(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  texto text NOT NULL,
  contenido text,
  autor character varying,
  padre_id integer REFERENCES public.comentarios(id) ON DELETE CASCADE,
  fecha timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 5. TABLA DE LIKES
-- ==========================================
CREATE TABLE public.likes (
  id SERIAL PRIMARY KEY,
  receta_id integer REFERENCES public.recetas(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  fecha timestamp with time zone DEFAULT now(),
  UNIQUE(receta_id, usuario_id)
);

-- ==========================================
-- 6. TABLA DE FAVORITOS
-- ==========================================
CREATE TABLE public.favoritos (
  id SERIAL PRIMARY KEY,
  receta_id integer REFERENCES public.recetas(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  fecha timestamp with time zone DEFAULT now(),
  UNIQUE(receta_id, usuario_id)
);

-- ==========================================
-- 7. TABLA DE NOTIFICACIONES
-- ==========================================
CREATE TABLE public.notificaciones (
  id SERIAL PRIMARY KEY,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo character varying,
  leida boolean DEFAULT false,
  mensaje text NOT NULL,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 8. TABLA DE OTP Y TOKENS
-- ==========================================
CREATE TABLE public.otp_tokens (
  id SERIAL PRIMARY KEY,
  email character varying NOT NULL,
  otp character varying NOT NULL,
  tipo character varying DEFAULT 'registro'::character varying,
  datos jsonb,
  usado boolean DEFAULT false,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 9. TABLA DE PUNTOS LOG
-- ==========================================
CREATE TABLE public.puntos_log (
  id SERIAL PRIMARY KEY,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  accion character varying NOT NULL,
  puntos integer NOT NULL,
  descripcion text,
  fecha timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 10. TABLA DE HISTORIAL
-- ==========================================
CREATE TABLE public.historial (
  id SERIAL PRIMARY KEY,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  receta_id integer REFERENCES public.recetas(id) ON DELETE CASCADE,
  fecha timestamp with time zone DEFAULT now(),
  UNIQUE(usuario_id, receta_id)
);

-- ==========================================
-- 11. TABLA DE PLANES SEMANALES
-- ==========================================
CREATE TABLE public.planes_semanales (
  id SERIAL PRIMARY KEY,
  usuario_id uuid UNIQUE REFERENCES public.usuarios(id) ON DELETE CASCADE,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 12. TABLA DE LISTA DE COMPRAS
-- ==========================================
CREATE TABLE public.lista_compras (
  id SERIAL PRIMARY KEY,
  usuario_id uuid UNIQUE REFERENCES public.usuarios(id) ON DELETE CASCADE,
  items jsonb DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 13. TABLA DE PRECIOS DE INGREDIENTES
-- ==========================================
CREATE TABLE public.precios_ingredientes (
  id SERIAL PRIMARY KEY,
  nombre text NOT NULL UNIQUE,
  precio_por_unidad numeric NOT NULL,
  unidad text DEFAULT 'pieza'::text,
  ultima_actualizacion timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 14. TABLA DE MÉTODOS DE PAGO
-- ==========================================
CREATE TABLE public.metodos_pago (
  id SERIAL PRIMARY KEY,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tarjeta_mask character varying NOT NULL,
  token_pago character varying NOT NULL,
  fecha_registro timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 15. TABLA DE SUSCRIPCIONES PUSH
-- ==========================================
CREATE TABLE public.push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  subscription jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 16. FUNCIONES ÚTILES (RPC)
-- ==========================================

-- Incrementar likes en tabla recetas
CREATE OR REPLACE FUNCTION increment_likes(receta_id integer)
RETURNS void AS $$
BEGIN
  UPDATE recetas SET likes = likes + 1 WHERE id = receta_id;
END;
$$ LANGUAGE plpgsql;

-- Calcular costo base simulado
CREATE OR REPLACE FUNCTION calcular_costo_receta(ingredientes_text text)
RETURNS numeric AS $$
DECLARE
    total_costo numeric := 0;
BEGIN
    SELECT count(*) * 15.50 INTO total_costo
    FROM unnest(string_to_array(ingredientes_text, E'\n')) AS t(ing)
    WHERE trim(ing) != '';
    
    IF total_costo = 0 THEN
        total_costo := 35.00;
    END IF;
    
    RETURN total_costo;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 17. CONFIGURACIÓN DE STORAGE (BUCKETS)
-- ==========================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('recetas', 'recetas', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Permitir lectura publica en recetas" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subida en recetas" ON storage.objects;
DROP POLICY IF EXISTS "Permitir modificar en recetas" ON storage.objects;
DROP POLICY IF EXISTS "Permitir eliminar en recetas" ON storage.objects;

CREATE POLICY "Permitir lectura publica en recetas" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'recetas' );

CREATE POLICY "Permitir subida en recetas" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'recetas' );

CREATE POLICY "Permitir modificar en recetas" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'recetas' );

CREATE POLICY "Permitir eliminar en recetas" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'recetas' );