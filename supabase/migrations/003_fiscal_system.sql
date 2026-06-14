-- ============================================================
-- Expensia — Sistema Fiscal Inteligente
-- Migration 003: tablas de CFDIs, movimientos bancarios,
--                alertas, perfil fiscal y relaciones contador
-- ============================================================

-- 1. CFDIs subidos por el contribuyente
CREATE TABLE IF NOT EXISTS cfdis (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uuid                    TEXT NOT NULL,
  tipo_comprobante        TEXT NOT NULL DEFAULT 'E', -- I=ingreso E=egreso T=traslado P=pago N=nomina
  fecha                   TIMESTAMPTZ NOT NULL,
  subtotal                DECIMAL(15,2) NOT NULL DEFAULT 0,
  total                   DECIMAL(15,2) NOT NULL DEFAULT 0,
  moneda                  TEXT NOT NULL DEFAULT 'MXN',
  tipo_cambio             DECIMAL(10,6) NOT NULL DEFAULT 1,
  rfc_emisor              TEXT NOT NULL DEFAULT '',
  nombre_emisor           TEXT NOT NULL DEFAULT '',
  rfc_receptor            TEXT NOT NULL DEFAULT '',
  uso_cfdi                TEXT NOT NULL DEFAULT '',
  lugar_expedicion        TEXT NOT NULL DEFAULT '',
  conceptos               TEXT NOT NULL DEFAULT '',   -- texto concatenado de conceptos
  xml_raw                 TEXT,                        -- XML original (puede ser grande)
  estado                  TEXT NOT NULL DEFAULT 'vigente',  -- vigente | cancelado | no_encontrado
  sat_verified_at         TIMESTAMPTZ,
  validation_status       TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | ok | error | warning
  validation_errors       JSONB NOT NULL DEFAULT '[]',
  risk_score              INTEGER NOT NULL DEFAULT 0,         -- 0-100
  risk_level              TEXT NOT NULL DEFAULT 'sin_evaluar', -- bajo | medio | alto | sin_evaluar
  coherencia              TEXT,                               -- alta | media | baja
  coherencia_razon        TEXT,
  is_deducible_estimado   BOOLEAN,
  matched_bank_movement_id UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, uuid)  -- un usuario no puede tener el mismo CFDI dos veces
);

-- 2. Movimientos bancarios importados
CREATE TABLE IF NOT EXISTS bank_movements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha            DATE NOT NULL,
  descripcion      TEXT NOT NULL DEFAULT '',
  monto            DECIMAL(15,2) NOT NULL,
  tipo             TEXT NOT NULL DEFAULT 'cargo',   -- cargo | abono
  referencia       TEXT NOT NULL DEFAULT '',
  banco            TEXT NOT NULL DEFAULT '',
  matched_cfdi_id  UUID REFERENCES cfdis(id) ON DELETE SET NULL,
  match_status     TEXT NOT NULL DEFAULT 'unmatched', -- matched | partial_match | unmatched
  match_confidence DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Alertas fiscales generadas por el sistema
CREATE TABLE IF NOT EXISTS fiscal_alerts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo                TEXT NOT NULL,
  -- tipos posibles: cfdi_cancelado | rfc_no_coincide | campo_faltante | duplicado |
  --                 sin_pago | pago_sin_cfdi | coherencia_baja | monto_alto
  nivel               TEXT NOT NULL DEFAULT 'warning', -- info | warning | error | critical
  titulo              TEXT NOT NULL,                   -- texto simple para el usuario
  descripcion         TEXT NOT NULL,                   -- 1 oración de problema
  que_hacer           TEXT NOT NULL DEFAULT '',         -- 1 oración de qué hacer
  descripcion_tecnica TEXT NOT NULL DEFAULT '',         -- detalle técnico para el contador
  evidencia           JSONB NOT NULL DEFAULT '{}',     -- datos exactos que generaron la alerta
  cfdi_id             UUID REFERENCES cfdis(id) ON DELETE CASCADE,
  bank_movement_id    UUID REFERENCES bank_movements(id) ON DELETE CASCADE,
  is_resolved         BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Perfil fiscal dinámico (uno por usuario, se actualiza con el historial)
CREATE TABLE IF NOT EXISTS fiscal_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  rfc                   TEXT NOT NULL DEFAULT '',
  regimen               TEXT NOT NULL DEFAULT '',
  actividad_economica   TEXT NOT NULL DEFAULT '',
  patron_gastos         JSONB NOT NULL DEFAULT '{}',  -- distribución por categoría + RFC frecuentes
  score_salud           INTEGER NOT NULL DEFAULT 100,  -- 0-100
  excepciones_abiertas  INTEGER NOT NULL DEFAULT 0,
  nivel_riesgo_global   TEXT NOT NULL DEFAULT 'bajo',
  ultimo_analisis       TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Relaciones contribuyente ↔ contador
CREATE TABLE IF NOT EXISTS contador_relationships (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribuyente_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contador_email      TEXT NOT NULL,
  contador_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL hasta que acepta
  status              TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | activo | revocado
  permissions         JSONB NOT NULL DEFAULT '{"read": true}',
  invited_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at         TIMESTAMPTZ,
  UNIQUE(contribuyente_id, contador_email)
);

-- ============================================================
-- Índices para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cfdis_user_id        ON cfdis(user_id);
CREATE INDEX IF NOT EXISTS idx_cfdis_risk_level      ON cfdis(user_id, risk_level);
CREATE INDEX IF NOT EXISTS idx_cfdis_estado          ON cfdis(user_id, estado);
CREATE INDEX IF NOT EXISTS idx_bank_movements_user   ON bank_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_movements_match  ON bank_movements(user_id, match_status);
CREATE INDEX IF NOT EXISTS idx_fiscal_alerts_user    ON fiscal_alerts(user_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_fiscal_alerts_nivel   ON fiscal_alerts(user_id, nivel, is_resolved);
CREATE INDEX IF NOT EXISTS idx_contador_rel_email    ON contador_relationships(contador_email);
CREATE INDEX IF NOT EXISTS idx_contador_rel_contrib  ON contador_relationships(contribuyente_id, status);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE cfdis                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_movements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_alerts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contador_relationships ENABLE ROW LEVEL SECURITY;

-- cfdis: el usuario ve/edita solo los suyos
CREATE POLICY "cfdis_owner" ON cfdis
  FOR ALL USING (auth.uid() = user_id);

-- cfdis: el contador con relación activa puede hacer SELECT
CREATE POLICY "cfdis_contador_read" ON cfdis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contador_relationships cr
      WHERE cr.contribuyente_id = cfdis.user_id
        AND cr.contador_user_id = auth.uid()
        AND cr.status = 'activo'
    )
  );

-- bank_movements
CREATE POLICY "bank_movements_owner" ON bank_movements
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "bank_movements_contador_read" ON bank_movements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contador_relationships cr
      WHERE cr.contribuyente_id = bank_movements.user_id
        AND cr.contador_user_id = auth.uid()
        AND cr.status = 'activo'
    )
  );

-- fiscal_alerts
CREATE POLICY "fiscal_alerts_owner" ON fiscal_alerts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "fiscal_alerts_contador_read" ON fiscal_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contador_relationships cr
      WHERE cr.contribuyente_id = fiscal_alerts.user_id
        AND cr.contador_user_id = auth.uid()
        AND cr.status = 'activo'
    )
  );

-- fiscal_profiles
CREATE POLICY "fiscal_profiles_owner" ON fiscal_profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "fiscal_profiles_contador_read" ON fiscal_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contador_relationships cr
      WHERE cr.contribuyente_id = fiscal_profiles.user_id
        AND cr.contador_user_id = auth.uid()
        AND cr.status = 'activo'
    )
  );

-- contador_relationships: cada parte ve sus propias relaciones
CREATE POLICY "contador_rel_contribuyente" ON contador_relationships
  FOR ALL USING (auth.uid() = contribuyente_id);

CREATE POLICY "contador_rel_contador" ON contador_relationships
  FOR SELECT USING (auth.uid() = contador_user_id);

CREATE POLICY "contador_rel_accept" ON contador_relationships
  FOR UPDATE USING (
    contador_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND status = 'pendiente'
  );
