/**
 * Seed idempotente de 60 usuarios de prueba completos (30 mujeres + 30 hombres)
 * identificados con el dominio `@iam.test`.
 *
 * Uso:
 *   npm run seed:test-users
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const TEST_DOMAIN = '@iam.test';
const DEFAULT_LAT = -33.4569; // Santiago centro (fallback)
const DEFAULT_LNG = -70.6483;

const FEMALE_NAMES = [
  'Sofía', 'Valentina', 'Camila', 'Isidora', 'Martina', 'Florencia',
  'Catalina', 'Antonia', 'Emilia', 'Javiera', 'Fernanda', 'Constanza',
  'Paula', 'Ignacia', 'Trinidad', 'Amanda', 'Josefa', 'Maite',
  'Rocío', 'Belen', 'Daniela', 'Francisca', 'Gabriela', 'Laura',
  'Elena', 'Lucía', 'Victoria', 'Renata', 'Paz', 'Agustina',
];

const MALE_NAMES = [
  'Mateo', 'Sebastián', 'Matías', 'Benjamín', 'Vicente', 'Tomás',
  'Lucas', 'Martín', 'Joaquín', 'Diego', 'Nicolás', 'Gabriel',
  'Felipe', 'Cristóbal', 'Ignacio', 'Bastián', 'Agustín', 'Maximiliano',
  'Alonso', 'Rodrigo', 'Andrés', 'Pablo', 'Simón', 'Emilio',
  'Bruno', 'Daniel', 'Julián', 'Samuel', 'Rafael', 'Esteban',
];

const LAST_NAMES = [
  'Rojas', 'González', 'Muñoz', 'Díaz', 'Pérez', 'Soto', 'Contreras',
  'Silva', 'Martínez', 'Sepúlveda', 'Morales', 'Rodríguez', 'López',
  'Fuentes', 'Hernández', 'Torres', 'Araya', 'Flores', 'Espinoza', 'Valdés',
];

const DIAGNOSES = ['TEA', 'TDAH', 'AACC', 'DISLEXIA', 'AUTOIDENTIFIED'];
const CONTACT_MODES = ['text', 'voice', 'video', 'in_person'];
const COMM_STYLES = [
  'Directa y clara, prefiero mensajes sin rodeos',
  'Conversación tranquila, a veces tardo en responder',
  'Muy expresiva cuando hablamos de mis temas favoritos',
  'Prefiero audios cortos o texto estructurado',
  'Me encanta profundizar en un solo tema a la vez',
];
const SENSORY_NOTES = [
  'Prefiero cafés tranquilos con luz cálida y poca música',
  'Me molestan los lugares muy ruidosos; ideal parques o librerías',
  'Todo bien con espacios abiertos o cafeterías de barrio',
  'Uso audífonos con cancelación de ruido en lugares concurridos',
];
const BIOS = [
  'Fan de los mapas, el café de especialidad y las charlas largas sin small talk.',
  'Siempre con mil pestañas abiertas en el cerebro. Busco gente real para conversar.',
  'Me encanta armar legos, programar y caminar sin prisa por la ciudad.',
  'Amante de los gatos, la astronomía y los juegos de mesa cooperativos.',
  'Disfruto el silencio cómodo tanto como hablar 3 horas de cine o música.',
  'Buscando conexiones auténticas donde no haya que hacer masking.',
  'Colecciono libros de ciencia ficción y recetas de té. ¿Tomamos algo?',
  'Hiperfoco actual: fotografía analógica y senderismo suave.',
  'Prefiero mil veces una caminata tranquila que una fiesta con ruido.',
  'Neurodivergente orgullosa/o. Me cuesta el inicio, pero después no paro de reír.',
];

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function parseWkbPoint(hex) {
  if (typeof hex !== 'string' || hex.length < 42) return null;
  try {
    const buf = Buffer.from(hex, 'hex');
    const littleEndian = buf[0] === 1;
    const type = littleEndian ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
    const hasSrid = (type & 0x20000000) !== 0;
    const offset = hasSrid ? 9 : 5;
    if (buf.length < offset + 16) return null;
    const lng = littleEndian ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset);
    const lat = littleEndian ? buf.readDoubleLE(offset + 8) : buf.readDoubleBE(offset + 8);
    return { lat, lng };
  } catch {
    return null;
  }
}

async function resolveCenterLocation(client) {
  const { data: realUsers } = await client
    .from('users')
    .select('id, email, location')
    .not('email', 'like', `%${TEST_DOMAIN}`)
    .not('location', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (realUsers && realUsers.length > 0) {
    for (const u of realUsers) {
      if (typeof u.location === 'string') {
        const parsed = parseWkbPoint(u.location);
        if (parsed) {
          console.log(`📍 Usando ubicación de usuario real (${u.email}): ${parsed.lat.toFixed(4)}, ${parsed.lng.toFixed(4)}`);
          return parsed;
        }
      }
    }
  }

  console.log(`📍 Sin ubicación real previa; usando fallback Santiago: ${DEFAULT_LAT}, ${DEFAULT_LNG}`);
  return { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en apps/backend/.env');
    process.exit(1);
  }

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const center = await resolveCenterLocation(client);

  // Cargar catálogo real de spin_tags
  const { data: spinTags, error: spinErr } = await client
    .from('spin_tags')
    .select('id, display_name')
    .limit(100);

  if (spinErr) {
    console.error('❌ Error leyendo spin_tags:', spinErr.message);
    process.exit(1);
  }
  const tagIds = (spinTags ?? []).map((t) => t.id);
  console.log(`🏷️  Tags SpIn disponibles: ${tagIds.length}`);

  const createdUserIds = [];

  for (let i = 1; i <= 60; i++) {
    const isFemale = i <= 30;
    const idx = isFemale ? i - 1 : i - 31;
    const firstName = isFemale ? FEMALE_NAMES[idx] : MALE_NAMES[idx];
    const lastName = LAST_NAMES[(i * 7) % LAST_NAMES.length];
    const displayName = `${firstName} ${lastName}`;
    const num = String(i).padStart(2, '0');
    const email = `test.seed.${num}${TEST_DOMAIN}`;
    const username = `seed_${isFemale ? 'f' : 'm'}_${num}`;
    const authId = `seed-auth-${num}`;
    const gender = isFemale ? 'female' : 'male';

    // Edad entre 21 y 38 años
    const age = 21 + (i % 18);
    const birthYear = new Date().getFullYear() - age;
    const birthMonth = String(((i * 3) % 12) + 1).padStart(2, '0');
    const birthDay = String(((i * 5) % 27) + 1).padStart(2, '0');
    const birthDate = `${birthYear}-${birthMonth}-${birthDay}`;

    // Coordenada aleatoria entre ~0.4 km y ~8.5 km del centro
    const angle = seededRandom(i * 13.37) * Math.PI * 2;
    const distKm = 0.4 + seededRandom(i * 29.11) * 8.1;
    const dLat = (distKm / 111.0) * Math.cos(angle);
    const dLng = (distKm / (111.0 * Math.cos((center.lat * Math.PI) / 180))) * Math.sin(angle);
    const lat = center.lat + dLat;
    const lng = center.lng + dLng;

    const portraitNum = (idx % 30) + 1;
    const avatarUrl = `https://randomuser.me/api/portraits/${isFemale ? 'women' : 'men'}/${portraitNum}.jpg`;

    const userRow = {
      email,
      auth_provider: 'google',
      auth_id: authId,
      username,
      display_name: displayName,
      birth_date: birthDate,
      is_teen: false,
      gender,
      location: `SRID=4326;POINT(${lng.toFixed(6)} ${lat.toFixed(6)})`,
      avatar_url: avatarUrl,
      msn_status: BIOS[i % BIOS.length],
      energy_level: (i % 3) + 1,
      notif_level: (i % 3) + 1,
      is_active: true,
      onboarding_completed: true,
    };

    const { data: upserted, error: upsertErr } = await client
      .from('users')
      .upsert(userRow, { onConflict: 'email' })
      .select('id')
      .single();

    if (upsertErr || !upserted) {
      console.error(`❌ Error upserting ${email}:`, upsertErr?.message);
      continue;
    }
    const userId = upserted.id;
    createdUserIds.push(userId);

    // Diagnóstico primario (+ secundario opcional)
    const primaryDiag = DIAGNOSES[i % DIAGNOSES.length];
    await client.from('user_diagnoses').delete().eq('user_id', userId);
    const diagRows = [{ user_id: userId, diagnosis: primaryDiag, is_primary: true }];
    if (i % 3 === 0) {
      const secondaryDiag = DIAGNOSES[(i + 2) % DIAGNOSES.length];
      if (secondaryDiag !== primaryDiag) {
        diagRows.push({ user_id: userId, diagnosis: secondaryDiag, is_primary: false });
      }
    }
    await client.from('user_diagnoses').insert(diagRows);

    // Preferencias ("Manual de Usuario")
    await client.from('user_preferences').upsert({
      user_id: userId,
      communication_style: COMM_STYLES[i % COMM_STYLES.length],
      understands_sarcasm: i % 2 === 0,
      preferred_contact: CONTACT_MODES[i % CONTACT_MODES.length],
      response_time_notes: 'Respondo en unas horas según mi energía del día.',
      sensory_notes: SENSORY_NOTES[i % SENSORY_NOTES.length],
    }, { onConflict: 'user_id' });

    // SpIn tags (3 a 6 por usuario)
    if (tagIds.length > 0) {
      await client.from('user_spin').delete().eq('user_id', userId);
      const count = 3 + (i % 4);
      const chosen = new Set();
      for (let k = 0; k < count; k++) {
        chosen.add(tagIds[(i * 5 + k * 7) % tagIds.length]);
      }
      await client.from('user_spin').insert(
        Array.from(chosen).map((spin_tag_id) => ({ user_id: userId, spin_tag_id })),
      );
    }

    // Fotos en galería: cantidad aleatoria entre 2 y 4 por usuario
    await client.from('user_photos').delete().eq('user_id', userId);
    const photoCount = 2 + Math.floor(seededRandom(i * 97.3) * 3); // 2, 3 o 4
    const photoRows = [];
    for (let pos = 0; pos < photoCount; pos++) {
      const publicUrl =
        pos === 0
          ? avatarUrl
          : `https://picsum.photos/seed/${username}-${pos}/800/1000`;
      photoRows.push({
        user_id: userId,
        storage_path: `seed/${username}/photo-${pos}.jpg`,
        public_url: publicUrl,
        file_size: 145000 + pos * 12000,
        mime_type: 'image/jpeg',
        position: pos,
      });
    }
    const { error: photoErr } = await client.from('user_photos').insert(photoRows);
    if (photoErr) {
      console.error(`⚠️  Fotos para ${username}:`, photoErr.message);
    }
  }

  // Opcional: dejar 15 likes entrantes hacia usuarios reales para probar Match inmediato
  const { data: realTargets } = await client
    .from('users')
    .select('id, email')
    .not('email', 'like', `%${TEST_DOMAIN}`);

  if (realTargets && realTargets.length > 0 && createdUserIds.length >= 15) {
    const likeRows = [];
    for (const target of realTargets) {
      for (let k = 0; k < 15; k++) {
        likeRows.push({
          swiper_id: createdUserIds[k],
          swiped_id: target.id,
          direction: 'like',
        });
      }
    }
    await client
      .from('swipes')
      .upsert(likeRows, { onConflict: 'swiper_id,swiped_id' });
    console.log(`💜 ${likeRows.length} likes previos sembrados hacia ${realTargets.length} cuenta(s) real(es) para probar Matches.`);
  }

  console.log(`✅ Seed completado: ${createdUserIds.length} perfiles listos (30 mujeres, 30 hombres, 2–4 fotos c/u).`);

  // Sembrar 6 venues de prueba cerca de la ubicación del usuario
  const testVenues = [
    {
      name: 'Café Calma Sensorial',
      slug: 'seed-cafe-calma-sensorial',
      description: 'Cafetería tranquila con luz cálida, música suave y mesas amplias.',
      category: 'cafe',
      address: 'Av. Principal 420',
      city: 'Copiapó',
      country: 'CL',
      amenities: ['wifi', 'silencioso', 'accesible', 'enchufes'],
      sensory_rating: 2,
      is_active: true,
      is_verified: true,
      esencias_multiplier: 1.5,
      dLat: 0.008,
      dLng: 0.006,
    },
    {
      name: 'Cowork Neuroespacio',
      slug: 'seed-cowork-neuroespacio',
      description: 'Espacio de foco compartido con cabinas silenciosas y zona social.',
      category: 'coworking',
      address: 'Calle Los Carrera 715',
      city: 'Copiapó',
      country: 'CL',
      amenities: ['wifi', 'silencioso', 'enchufes', 'zona_silenciosa'],
      sensory_rating: 1,
      is_active: true,
      is_verified: true,
      esencias_multiplier: 2.0,
      dLat: -0.006,
      dLng: 0.011,
    },
    {
      name: 'Parque Alameda Verde',
      slug: 'seed-parque-alameda-verde',
      description: 'Área verde abierta ideal para caminatas tranquilas y primer meetup.',
      category: 'parque',
      address: 'Av. Matta s/n',
      city: 'Copiapó',
      country: 'CL',
      amenities: ['aire_libre', 'accesible'],
      sensory_rating: 2,
      is_active: true,
      is_verified: true,
      esencias_multiplier: 1.5,
      dLat: 0.012,
      dLng: -0.009,
    },
    {
      name: 'Biblioteca Silencio Vivo',
      slug: 'seed-biblioteca-silencio-vivo',
      description: 'Salas de lectura con iluminación natural y cero ruido ambiental.',
      category: 'biblioteca',
      address: 'Atacama 530',
      city: 'Copiapó',
      country: 'CL',
      amenities: ['wifi', 'silencioso', 'accesible'],
      sensory_rating: 1,
      is_active: true,
      is_verified: true,
      esencias_multiplier: 2.0,
      dLat: -0.011,
      dLng: -0.005,
    },
    {
      name: 'Bistró Luz Suave',
      slug: 'seed-bistro-luz-suave',
      description: 'Restaurante de barrio con menú claro y mesas privadas.',
      category: 'restaurante',
      address: 'Chacabuco 280',
      city: 'Copiapó',
      country: 'CL',
      amenities: ['accesible', 'zona_silenciosa'],
      sensory_rating: 3,
      is_active: true,
      is_verified: true,
      esencias_multiplier: 1.5,
      dLat: 0.004,
      dLng: -0.013,
    },
    {
      name: 'Librería & Té Mirador',
      slug: 'seed-libreria-te-mirador',
      description: 'Tienda de libros y té en hebras con rincón de lectura y juegos de mesa.',
      category: 'tienda',
      address: 'Colipí 610',
      city: 'Copiapó',
      country: 'CL',
      amenities: ['wifi', 'silencioso', 'accesible'],
      sensory_rating: 2,
      is_active: true,
      is_verified: true,
      esencias_multiplier: 1.5,
      dLat: -0.004,
      dLng: 0.004,
    },
  ];

  const venueRows = testVenues.map(({ dLat, dLng, ...v }) => ({
    ...v,
    location: `SRID=4326;POINT(${(center.lng + dLng).toFixed(6)} ${(center.lat + dLat).toFixed(6)})`,
  }));

  const { error: venueErr } = await client
    .from('venues')
    .upsert(venueRows, { onConflict: 'slug' });
  if (venueErr) {
    console.warn('⚠️  Venues seed:', venueErr.message);
  } else {
    console.log(`📍 ${venueRows.length} venues de prueba sembrados cerca de tu ubicación.`);
  }

  // Sembrar 8 historias de prueba activas (24h) para que la barra de Historias en Chat se vea viva
  if (createdUserIds.length >= 8) {
    await client.from('stories').delete().in('user_id', createdUserIds);
    const storyCaptions = [
      'Café tranquilo para empezar el día ☕',
      'Armando un puzzle de 1000 piezas hoy 🧩',
      'Caminata sin audífonos por el parque 🌿',
      'Leyendo ciencia ficción con té verde 🍵',
      'Modo hiperfoco activado 💻',
      'Atardecer en la ciudad ✨',
      'Probando mi nueva cámara analógica 📷',
      'Buscando compañía para body doubling 📖',
    ];
    const storyRows = createdUserIds.slice(0, 8).map((uid, idx) => ({
      user_id: uid,
      image_url: `https://picsum.photos/seed/iam-story-${idx + 1}/720/1280`,
      caption: storyCaptions[idx % storyCaptions.length],
    }));
    const { error: storyErr } = await client.from('stories').insert(storyRows);
    if (storyErr) {
      console.warn('⚠️  Stories seed:', storyErr.message);
    } else {
      console.log(`📸 ${storyRows.length} historias de prueba sembradas.`);
    }
  }
}

main().catch((err) => {
  console.error('❌ Error fatal en seed:', err);
  process.exit(1);
});

