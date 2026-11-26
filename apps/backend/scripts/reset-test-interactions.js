/**
 * Reinicia TODAS las interacciones (swipes, matches, mensajes, meetups,
 * notificaciones, bloqueos, reportes) que involucren a los usuarios `@iam.test`,
 * dejando los 60 perfiles y tu cuenta real intactos.
 *
 * Uso:
 *   npm run reset:test-interactions
 *   node scripts/reset-test-interactions.js --no-likes
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const TEST_DOMAIN = '@iam.test';

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en apps/backend/.env');
    process.exit(1);
  }

  const noLikes = process.argv.includes('--no-likes');
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: testUsers, error: usersErr } = await client
    .from('users')
    .select('id')
    .like('email', `%${TEST_DOMAIN}`)
    .order('email', { ascending: true });

  if (usersErr) {
    console.error('❌ Error consultando usuarios de prueba:', usersErr.message);
    process.exit(1);
  }

  const testIds = (testUsers ?? []).map((u) => u.id);
  if (testIds.length === 0) {
    console.log('ℹ️  No hay usuarios @iam.test en la DB. Ejecuta primero: npm run seed:test-users');
    return;
  }

  const idList = testIds.join(',');

  // 1. Buscar matches donde participe algún usuario de prueba
  const { data: matches } = await client
    .from('matches')
    .select('id')
    .or(`user_a_id.in.(${idList}),user_b_id.in.(${idList})`);
  const matchIds = (matches ?? []).map((m) => m.id);

  // 2. Borrar mensajes y meetups asociados a esos matches
  if (matchIds.length > 0) {
    const matchList = matchIds.join(',');
    await client.from('messages').delete().in('match_id', matchIds);
    await client.from('meetup_confirmations').delete().in('match_id', matchIds);
    await client.from('matches').delete().in('id', matchIds);
    console.log(`🧹 Eliminados ${matchIds.length} matches (+ mensajes y meetups asociados).`);
  } else {
    console.log('🧹 0 matches para limpiar.');
  }

  // 3. Borrar swipes, blocks, reports y notificaciones de usuarios de prueba
  await client
    .from('swipes')
    .delete()
    .or(`swiper_id.in.(${idList}),swiped_id.in.(${idList})`);

  await client
    .from('blocks')
    .delete()
    .or(`blocker_id.in.(${idList}),blocked_id.in.(${idList})`);

  await client
    .from('reports')
    .delete()
    .or(`reporter_id.in.(${idList}),reported_id.in.(${idList})`);

  await client
    .from('notifications')
    .delete()
    .in('user_id', testIds);

  console.log('🧹 Swipes, bloqueos, reportes y notificaciones de prueba limpiados.');

  // 4. Re-sembrar 15 likes entrantes hacia cuentas reales para probar Match inmediato
  if (!noLikes) {
    const { data: realTargets } = await client
      .from('users')
      .select('id')
      .not('email', 'like', `%${TEST_DOMAIN}`);

    if (realTargets && realTargets.length > 0 && testIds.length >= 15) {
      const likeRows = [];
      for (const target of realTargets) {
        for (let k = 0; k < 15; k++) {
          likeRows.push({
            swiper_id: testIds[k],
            swiped_id: target.id,
            direction: 'like',
          });
        }
      }
      await client
        .from('swipes')
        .upsert(likeRows, { onConflict: 'swiper_id,swiped_id' });
      console.log(`💜 ${likeRows.length} likes entrantes restaurados para probar Matches.`);
    }
  }

  console.log(`✅ Listo: ${testIds.length} usuarios de prueba reseteados y listos en el Feed.`);
}

main().catch((err) => {
  console.error('❌ Error fatal en reset:', err);
  process.exit(1);
});

