-- Esquema de Base de Datos Consolidado para ForaneoKitchen
-- Esta versión incluye todas las tablas del proyecto, optimizaciones de rendimiento y compatibilidad total con el código JS.

-- 1. Extensiones Necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nombre character varying NOT NULL,
  apellido character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  username character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  rol character varying DEFAULT 'free'::character varying CHECK (rol::text = ANY (ARRAY['free'::character varying, 'premium'::character varying, 'admin'::character varying]::text[])),
  es_premium boolean DEFAULT false,
  premium_hasta timestamp with time zone,
  puntos integer DEFAULT 0,
  bio text DEFAULT ''::text,
  foto_perfil text,
  preferencias jsonb DEFAULT '[]'::jsonb,
  fecha_registro timestamp with time zone DEFAULT now(),
  ultimo_acceso timestamp with time zone,
  CONSTRAINT usuarios_pkey PRIMARY KEY (id)
);

-- 3. Tabla de Recetas (Incluye optimización para populares)
CREATE TABLE IF NOT EXISTS public.recetas (
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
  comentarios_count integer DEFAULT 0, -- Para algoritmo de popularidad
  fecha timestamp with time zone DEFAULT now()
);

-- 4. Tabla de Comentarios
CREATE TABLE IF NOT EXISTS public.comentarios (
  id SERIAL PRIMARY KEY,
  receta_id integer REFERENCES public.recetas(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  texto text NOT NULL,
  padre_id integer REFERENCES public.comentarios(id) ON DELETE CASCADE,
  fecha timestamp with time zone DEFAULT now()
);

-- 5. Tabla de Likes
CREATE TABLE IF NOT EXISTS public.likes (
  id SERIAL PRIMARY KEY,
  receta_id integer REFERENCES public.recetas(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  fecha timestamp with time zone DEFAULT now(),
  UNIQUE(receta_id, usuario_id)
);

-- 6. Tabla de Favoritos
CREATE TABLE IF NOT EXISTS public.favoritos (
  id SERIAL PRIMARY KEY,
  receta_id integer REFERENCES public.recetas(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  fecha timestamp with time zone DEFAULT now(),
  UNIQUE(receta_id, usuario_id)
);

-- 7. Tabla de Notificaciones
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id SERIAL PRIMARY KEY,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo character varying,
  leida boolean DEFAULT false,
  mensaje text NOT NULL,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- 8. Tabla de OTP y Tokens
CREATE TABLE IF NOT EXISTS public.otp_tokens (
  id SERIAL PRIMARY KEY,
  email character varying NOT NULL,
  otp character varying NOT NULL,
  tipo character varying DEFAULT 'registro'::character varying,
  datos jsonb,
  usado boolean DEFAULT false,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 9. Tabla de Puntos Log
CREATE TABLE IF NOT EXISTS public.puntos_log (
  id SERIAL PRIMARY KEY,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  accion character varying NOT NULL,
  puntos integer NOT NULL,
  descripcion text,
  fecha timestamp with time zone DEFAULT now()
);

-- 10. Tabla de Historial (Solo Premium)
CREATE TABLE IF NOT EXISTS public.historial (
  id SERIAL PRIMARY KEY,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  receta_id integer REFERENCES public.recetas(id) ON DELETE CASCADE,
  fecha timestamp with time zone DEFAULT now()
);

-- 11. Tabla de Planes Semanales (JSONB para sincronización rápida)
CREATE TABLE IF NOT EXISTS public.planes_semanales (
  id SERIAL PRIMARY KEY,
  usuario_id uuid UNIQUE REFERENCES public.usuarios(id) ON DELETE CASCADE,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 12. Tabla de Lista de Compras
CREATE TABLE IF NOT EXISTS public.lista_compras (
  id SERIAL PRIMARY KEY,
  usuario_id uuid UNIQUE REFERENCES public.usuarios(id) ON DELETE CASCADE,
  items jsonb DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone DEFAULT now()
);

-- 13. Tabla de Precios de Ingredientes
CREATE TABLE IF NOT EXISTS public.precios_ingredientes (
  id SERIAL PRIMARY KEY,
  nombre text NOT NULL UNIQUE,
  precio_por_unidad numeric NOT NULL,
  unidad text DEFAULT 'pieza'::text,
  ultima_actualizacion timestamp with time zone DEFAULT now()
);

-- 14. Tabla de Suscripciones Push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  subscription jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 15. Funciones Útiles (RPC)
-- Función para añadir puntos de forma segura
CREATE OR REPLACE FUNCTION add_puntos(uid UUID, pts INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE usuarios SET puntos = puntos + pts WHERE id = uid;
END;
$$ LANGUAGE plpgsql;
