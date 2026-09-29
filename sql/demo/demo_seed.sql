-- DATOS FICTICIOS DE DEMO (no es una migración). Todo lleva la marca DEMO para poder borrarlo con demo_limpiar.sql.
-- Las fechas son relativas a "hoy" en Bogotá, así se activan todos los widgets del Panel.
-- Ejecutar una sola vez (aborta si ya hay datos DEMO).
do $$
declare
  hoy date := (now() at time zone 'America/Bogota')::date;
  c_andina uuid; c_caribe uuid; c_puertos uuid; c_vias uuid; c_costa uuid; c_sol uuid;
  m_gr uuid; m_re uuid; m_mn uuid; m_vb uuid; m_pl uuid; m_ex uuid; m_cp uuid; a_ex uuid; q_comp uuid;
  q_grua50 uuid; q_retro uuid; q_mini uuid; q_plat uuid; q_vibro uuid; q_borrador uuid; q_grua80 uuid;
  a_gr uuid;
  h_andina uuid; h_puertos uuid; h_vias uuid;
begin
  if exists (select 1 from public.upbq_clientes where nombre like 'DEMO · %') then
    raise exception 'Ya existen datos DEMO: ejecuta primero demo_limpiar.sql';
  end if;

  -- Clientes ----------------------------------------------------------------
  insert into public.upbq_clientes (nombre, telefono, email, estado, notas) values
    ('DEMO · Constructora Andina', '300 111 2233', 'compras@andina.example.com', 'activo', 'Cliente frecuente. Paga a 30 días.') returning id into c_andina;
  insert into public.upbq_clientes (nombre, telefono, email, estado, notas) values
    ('DEMO · Ingeniería del Caribe', '301 222 3344', 'pagos@icaribe.example.com', 'en_mora', 'Factura de 45 días pendiente. Llamar a contabilidad.') returning id into c_caribe;
  insert into public.upbq_clientes (nombre, telefono, email, estado, notas) values
    ('DEMO · Puertos y Obras S.A.S.', '302 333 4455', 'obras@puertos.example.com', 'activo', 'Obra en la zona portuaria. Suele pedir dos equipos a la vez.') returning id into c_puertos;
  insert into public.upbq_clientes (nombre, telefono, email, estado, notas) values
    ('DEMO · Vías del Atlántico', '304 444 5566', 'gerencia@vias.example.com', 'prospecto', 'Contacto nuevo por referido.') returning id into c_vias;
  insert into public.upbq_clientes (nombre, telefono, email, estado, notas) values
    ('DEMO · Cementos Costa', '305 555 6677', null, 'bloqueado', 'Bloqueado por cartera. No alquilar sin pago anticipado.') returning id into c_costa;
  insert into public.upbq_clientes (nombre, telefono, email, estado, notas) values
    ('DEMO · Urbanizadora Sol', null, 'info@sol.example.com', 'inactivo', 'Sin proyectos desde el año pasado.') returning id into c_sol;

  -- Máquinas ----------------------------------------------------------------
  insert into public.upbq_maquinas (codigo, tipo, descripcion) values ('DEMO-GR-01', 'Grúa 50 t', 'Grúa telescópica, revisión al día') returning id into m_gr;
  insert into public.upbq_maquinas (codigo, tipo, descripcion) values ('DEMO-RE-02', 'Retroexcavadora', 'Cargador frontal + retro, 2019') returning id into m_re;
  insert into public.upbq_maquinas (codigo, tipo, descripcion) values ('DEMO-MN-03', 'Minicargador', 'Bobcat con implementos') returning id into m_mn;
  insert into public.upbq_maquinas (codigo, tipo, descripcion) values ('DEMO-VB-04', 'Vibrocompactador', 'Rodillo liso 10 t') returning id into m_vb;
  insert into public.upbq_maquinas (codigo, tipo, descripcion) values ('DEMO-PL-05', 'Plataforma elevadora', 'Tijera eléctrica 12 m') returning id into m_pl;
  insert into public.upbq_maquinas (codigo, tipo, descripcion) values ('DEMO-EX-06', 'Excavadora 20 t', 'Oruga, cuchara 1.2 m³') returning id into m_ex;
  insert into public.upbq_maquinas (codigo, tipo, descripcion) values ('DEMO-CP-07', 'Compresor', 'Compresor diésel 185 CFM') returning id into m_cp;

  -- Cotizaciones ------------------------------------------------------------
  insert into public.upbq_cotizaciones (cliente_id, equipo, valor, fecha, estado, proforma_solicitada, proforma_fecha, notas)
    values (c_andina, 'Grúa 50 t', 18500000, hoy - 3, 'en_seguimiento', true, hoy - 2, 'Necesitan izaje de vigas prefabricadas.') returning id into q_grua50;
  insert into public.upbq_cotizaciones (cliente_id, equipo, valor, fecha, estado, notas)
    values (c_vias, 'Retroexcavadora', 9200000, hoy - 9, 'enviada', 'Sin respuesta desde el envío.') returning id into q_retro;
  insert into public.upbq_cotizaciones (cliente_id, equipo, valor, fecha, estado, motivo_cierre, fecha_cierre)
    values (c_puertos, 'Minicargador', 6400000, hoy - 14, 'cerrada_ganada', 'Mejor precio y disponibilidad inmediata', hoy - 11) returning id into q_mini;
  insert into public.upbq_cotizaciones (cliente_id, equipo, valor, fecha, estado, motivo_cierre, fecha_cierre)
    values (c_caribe, 'Plataforma elevadora', 5100000, hoy - 20, 'cerrada_perdida', 'Eligió a la competencia por precio', hoy - 17) returning id into q_plat;
  insert into public.upbq_cotizaciones (cliente_id, equipo, valor, fecha, estado, motivo_cierre, fecha_cierre)
    values (c_andina, 'Vibrocompactador', 7800000, hoy - 40, 'cerrada_ganada', 'Cliente recurrente, tarifa pactada', hoy - 36) returning id into q_vibro;
  insert into public.upbq_cotizaciones (cliente_id, equipo, valor, fecha, estado)
    values (c_costa, 'Retroexcavadora', 12000000, hoy - 1, 'borrador') returning id into q_borrador;
  insert into public.upbq_cotizaciones (cliente_id, equipo, valor, fecha, estado, notas)
    values (c_puertos, 'Grúa 80 t', 24000000, hoy - 6, 'en_seguimiento', 'Esperan aprobación de la interventoría.') returning id into q_grua80;

  -- Alquileres + novedad ------------------------------------------------------
  insert into public.upbq_alquileres (maquina_id, cliente_id, cotizacion_id, fecha_inicio, fecha_fin, estado, notas)
    values (m_gr, c_andina, q_grua50, hoy - 10, hoy + 4, 'activo', 'Obra torre B.') returning id into a_gr;
  insert into public.upbq_alquiler_novedades (alquiler_id, fecha_desde, fecha_hasta, motivo, nota)
    values (a_gr, hoy - 5, hoy - 4, 'Lluvia', 'Suspendido por tormenta eléctrica.');
  insert into public.upbq_alquileres (maquina_id, cliente_id, fecha_inicio, fecha_fin, estado)
    values (m_gr, c_puertos, hoy + 8, hoy + 20, 'activo');
  insert into public.upbq_alquileres (maquina_id, cliente_id, fecha_inicio, fecha_fin, estado, notas)
    values (m_re, c_caribe, hoy - 20, hoy - 2, 'activo', 'Ya debió devolverse: confirmar con el cliente.');
  insert into public.upbq_alquileres (maquina_id, cliente_id, cotizacion_id, fecha_inicio, fecha_fin, estado)
    values (m_mn, c_puertos, q_mini, hoy + 3, hoy + 12, 'activo');
  insert into public.upbq_alquileres (maquina_id, cliente_id, cotizacion_id, fecha_inicio, fecha_fin, estado)
    values (m_vb, c_andina, q_vibro, hoy - 30, hoy - 15, 'finalizado');

  -- Alquiler largo que TRABAJA sábados (excluir_sabados = false) y con dos novedades: prueba el mapa de días con ventana
  insert into public.upbq_alquileres (maquina_id, cliente_id, fecha_inicio, fecha_fin, estado, excluir_sabados, notas)
    values (m_ex, c_puertos, hoy - 30, hoy + 25, 'activo', false, 'Movimiento de tierra muelle 2. Se trabaja también los sábados.') returning id into a_ex;
  insert into public.upbq_alquiler_novedades (alquiler_id, fecha_desde, fecha_hasta, motivo, nota) values
    (a_ex, hoy - 12, hoy - 11, 'Paro', 'Bloqueo de la vía de acceso.'),
    (a_ex, hoy - 3, hoy - 3, 'Lluvia', null);

  -- Recordatorios y pendientes -------------------------------------------------
  insert into public.upbq_recordatorios (cliente_id, cotizacion_id, texto, fecha, estado, auto) values
    (c_andina, q_grua50, 'Seguimiento de cotización (Grúa 50 t)', hoy, 'pendiente', true),
    (c_vias, q_retro, 'Seguimiento de cotización (Retroexcavadora)', hoy - 2, 'pendiente', true),
    (c_caribe, null, 'Cobrar factura vencida: llamar a contabilidad', hoy, 'pendiente', false),
    (c_puertos, q_mini, 'Seguimiento de cotización (Minicargador)', hoy - 11, 'hecho', true);
  insert into public.upbq_pendientes (texto, fecha, prioridad) values
    ('[DEMO] Renovar póliza de equipo pesado', hoy + 3, 'alta'),
    ('[DEMO] Actualizar tarifas 2027', null, 'media'),
    ('[DEMO] Pedir certificado de calibración de la grúa', hoy + 10, 'baja');

  -- Negociaciones (chat) ----------------------------------------------------------
  insert into public.upbq_negociaciones (cliente_id) values (c_andina) returning id into h_andina;
  insert into public.upbq_negociaciones (cliente_id) values (c_puertos) returning id into h_puertos;
  insert into public.upbq_negociaciones (cliente_id) values (c_vias) returning id into h_vias;

  insert into public.upbq_negociacion_mensajes (negociacion_id, cotizacion_id, fecha, emisor, tipo, contenido, origen, hash)
  select h_andina, v.cot, ((hoy - v.dias) + v.hora::time) at time zone 'America/Bogota', v.emisor, 'texto', v.texto, 'manual', md5(random()::text || clock_timestamp()::text || v.texto)
  from (values
    (38, '09:12', 'cliente',  q_vibro, 'Buenos días, necesitamos un vibrocompactador para la vía de acceso, unos 15 días.'),
    (38, '09:20', 'nosotros', q_vibro, 'Buen día, con gusto. Tenemos el de 10 t disponible desde el lunes. Le paso cotización.'),
    (37, '14:05', 'cliente',  q_vibro, '¿Incluye operador y transporte a la obra?'),
    (37, '14:31', 'nosotros', q_vibro, 'Incluye operador. El transporte va aparte: $450.000 ida y vuelta.'),
    (36, '10:02', 'cliente',  q_vibro, 'Perfecto, cerramos así. Confirmamos el lunes.'),
    (36, '10:05', 'nosotros', q_vibro, 'Listo, quedamos atentos. Gracias por la confianza.'),
    (4,  '08:40', 'cliente',  q_grua50, 'Hola, ahora necesitamos una grúa de 50 t para izar vigas prefabricadas. ¿Tienen disponibilidad?'),
    (4,  '08:52', 'nosotros', q_grua50, 'Sí, la de 50 t queda libre pronto. ¿Para qué fechas y cuántas horas de izaje?'),
    (4,  '09:15', 'cliente',  q_grua50, 'Dos semanas desde el próximo lunes. Enviamos las cargas por correo.'),
    (3,  '11:00', 'nosotros', q_grua50, 'Le envié la cotización por $18.500.000 con operador y rigger incluidos.'),
    (2,  '15:30', 'cliente',  q_grua50, 'Recibida. ¿Nos pueden mandar la proforma para pasarla a aprobación?'),
    (2,  '15:41', 'nosotros', q_grua50, 'Claro, hoy mismo la envío. Cualquier ajuste me avisa.'),
    (0,  '07:45', 'cliente',  q_grua50, 'Buenos días, ya tenemos la aprobación interna. ¿Confirmamos la fecha de inicio?')
  ) as v(dias, hora, emisor, cot, texto);

  insert into public.upbq_negociacion_mensajes (negociacion_id, cotizacion_id, fecha, emisor, tipo, contenido, origen, hash)
  select h_puertos, v.cot, ((hoy - v.dias) + v.hora::time) at time zone 'America/Bogota', v.emisor, 'texto', v.texto, 'manual', md5(random()::text || clock_timestamp()::text || v.texto)
  from (values
    (15, '10:10', 'cliente',  q_mini, 'Necesitamos un minicargador para movimiento de material en el muelle.'),
    (14, '09:00', 'nosotros', q_mini, 'Le cotizo hoy. ¿Con operador o solo el equipo?'),
    (12, '16:20', 'cliente',  q_mini, 'Solo el equipo, tenemos operador propio.'),
    (11, '08:30', 'cliente',  q_mini, 'Aprobado el minicargador. Inicia en dos semanas.'),
    (9,  '17:05', 'cliente',  q_grua80, 'Además estamos evaluando una grúa de 80 t para el mes próximo. Le escribo cuando tengamos fecha.')
  ) as v(dias, hora, emisor, cot, texto);

  insert into public.upbq_negociacion_mensajes (negociacion_id, cotizacion_id, fecha, emisor, tipo, contenido, origen, hash)
  select h_vias, v.cot, ((hoy - v.dias) + v.hora::time) at time zone 'America/Bogota', v.emisor, 'texto', v.texto, 'manual', md5(random()::text || clock_timestamp()::text || v.texto)
  from (values
    (10, '12:00', 'cliente',  null::uuid, 'Hola, me dieron su contacto. ¿Alquilan retroexcavadoras por semanas?'),
    (10, '12:15', 'nosotros', null::uuid, 'Sí señor, por días, semanas o meses. ¿Para qué tipo de obra?'),
    (9,  '09:40', 'nosotros', q_retro,   'Le envié la cotización de la retroexcavadora. Quedo atento.')
  ) as v(dias, hora, emisor, cot, texto);

  -- ── Ajustes del enfoque "agenda" (migración 007): días en cotizaciones, equipo varado, aprobadas sin alquiler, alquiler sin equipo
  update public.upbq_cotizaciones q set dias = case q.equipo
      when 'Grúa 50 t' then 15 when 'Retroexcavadora' then 10 when 'Minicargador' then 8
      when 'Plataforma elevadora' then 5 when 'Vibrocompactador' then 10 when 'Grúa 80 t' then 12 end
    where q.cliente_id in (select id from public.upbq_clientes where nombre like 'DEMO · %');
  update public.upbq_maquinas set estado = 'varada', nota = 'Falla en el sistema hidráulico de la tijera. Repuesto llega el viernes.' where codigo = 'DEMO-PL-05';
  update public.upbq_maquinas set nota = 'Revisión de 250 h pendiente el mes próximo.' where codigo = 'DEMO-GR-01';
  insert into public.upbq_cotizaciones (cliente_id, equipo, valor, dias, fecha, estado, motivo_cierre, fecha_cierre, notas)
    values (c_vias, 'Brazo hidráulico', 14500000, 15, hoy - 3, 'cerrada_ganada', 'Aprobada por el cliente', hoy - 1, 'Necesitan arrancar la próxima semana.');
  insert into public.upbq_cotizaciones (cliente_id, equipo, valor, dias, fecha, estado, motivo_cierre, fecha_cierre)
    values (c_andina, 'Compresor', 3200000, 5, hoy - 2, 'cerrada_ganada', 'Aprobada por el cliente', hoy - 1) returning id into q_comp;
  insert into public.upbq_alquileres (maquina_id, cliente_id, cotizacion_id, fecha_inicio, fecha_fin, estado, notas)
    values (null, c_andina, q_comp, hoy + 2, hoy + 2 + 6, 'activo', 'Equipo por asignar: definir cuál compresor sale.');
end $$;
