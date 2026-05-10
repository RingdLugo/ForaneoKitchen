-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.comentarios (
  id integer NOT NULL DEFAULT nextval('comentarios_id_seq'::regclass),
  receta_id integer,
  usuario_id uuid,
  texto text NOT NULL,
  contenido text,
  autor character varying,
  padre_id integer,
  fecha timestamp with time zone DEFAULT now(),
  CONSTRAINT comentarios_pkey PRIMARY KEY (id),
  CONSTRAINT comentarios_receta_id_fkey FOREIGN KEY (receta_id) REFERENCES public.recetas(id),
  CONSTRAINT comentarios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id),
  CONSTRAINT comentarios_padre_id_fkey FOREIGN KEY (padre_id) REFERENCES public.comentarios(id)
);
CREATE TABLE public.favoritos (
  id integer NOT NULL DEFAULT nextval('favoritos_id_seq'::regclass),
  receta_id integer,
  usuario_id uuid,
  fecha timestamp with time zone DEFAULT now(),
  CONSTRAINT favoritos_pkey PRIMARY KEY (id),
  CONSTRAINT favoritos_receta_id_fkey FOREIGN KEY (receta_id) REFERENCES public.recetas(id),
  CONSTRAINT favoritos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.historial (
  id integer NOT NULL DEFAULT nextval('historial_id_seq'::regclass),
  usuario_id uuid,
  receta_id integer,
  fecha timestamp with time zone DEFAULT now(),
  CONSTRAINT historial_pkey PRIMARY KEY (id),
  CONSTRAINT historial_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id),
  CONSTRAINT historial_receta_id_fkey FOREIGN KEY (receta_id) REFERENCES public.recetas(id)
);
CREATE TABLE public.likes (
  id integer NOT NULL DEFAULT nextval('likes_id_seq'::regclass),
  receta_id integer,
  usuario_id uuid,
  fecha timestamp with time zone DEFAULT now(),
  CONSTRAINT likes_pkey PRIMARY KEY (id),
  CONSTRAINT likes_receta_id_fkey FOREIGN KEY (receta_id) REFERENCES public.recetas(id),
  CONSTRAINT likes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.lista_compras (
  id integer NOT NULL DEFAULT nextval('lista_compras_id_seq'::regclass),
  usuario_id uuid UNIQUE,
  items jsonb DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lista_compras_pkey PRIMARY KEY (id),
  CONSTRAINT lista_compras_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.metodos_pago (
  id integer NOT NULL DEFAULT nextval('metodos_pago_id_seq'::regclass),
  usuario_id uuid,
  tarjeta_mask character varying NOT NULL,
  token_pago character varying NOT NULL,
  fecha_registro timestamp with time zone DEFAULT now(),
  CONSTRAINT metodos_pago_pkey PRIMARY KEY (id),
  CONSTRAINT metodos_pago_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.notificaciones (
  id integer NOT NULL DEFAULT nextval('notificaciones_id_seq'::regclass),
  usuario_id uuid,
  tipo character varying,
  leida boolean DEFAULT false,
  mensaje text NOT NULL,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notificaciones_pkey PRIMARY KEY (id),
  CONSTRAINT notificaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.otp_tokens (
  id integer NOT NULL DEFAULT nextval('otp_tokens_id_seq'::regclass),
  email character varying NOT NULL,
  otp character varying NOT NULL,
  tipo character varying DEFAULT 'registro'::character varying,
  datos jsonb,
  usado boolean DEFAULT false,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT otp_tokens_pkey PRIMARY KEY (id)
);
CREATE TABLE public.planes_semanales (
  id integer NOT NULL DEFAULT nextval('planes_semanales_id_seq'::regclass),
  usuario_id uuid UNIQUE,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT planes_semanales_pkey PRIMARY KEY (id),
  CONSTRAINT planes_semanales_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.precios_ingredientes (
  id integer NOT NULL DEFAULT nextval('precios_ingredientes_id_seq'::regclass),
  nombre text NOT NULL UNIQUE,
  precio_por_unidad numeric NOT NULL,
  unidad text DEFAULT 'pieza'::text,
  ultima_actualizacion timestamp with time zone DEFAULT now(),
  CONSTRAINT precios_ingredientes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.puntos_log (
  id integer NOT NULL DEFAULT nextval('puntos_log_id_seq'::regclass),
  usuario_id uuid,
  accion character varying NOT NULL,
  puntos integer NOT NULL,
  descripcion text,
  fecha timestamp with time zone DEFAULT now(),
  CONSTRAINT puntos_log_pkey PRIMARY KEY (id),
  CONSTRAINT puntos_log_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.push_subscriptions (
  id integer NOT NULL DEFAULT nextval('push_subscriptions_id_seq'::regclass),
  user_id uuid,
  subscription jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.recetas (
  id integer NOT NULL DEFAULT nextval('recetas_id_seq'::regclass),
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
  usuario_id uuid,
  likes integer DEFAULT 0,
  comentarios_count integer DEFAULT 0,
  fecha timestamp with time zone DEFAULT now(),
  CONSTRAINT recetas_pkey PRIMARY KEY (id),
  CONSTRAINT recetas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.usuarios (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nombre character varying NOT NULL,
  apellido character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  username character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  rol character varying DEFAULT 'free'::character varying CHECK (rol::text = ANY (ARRAY['free'::character varying::text, 'premium'::character varying::text, 'admin'::character varying::text])),
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