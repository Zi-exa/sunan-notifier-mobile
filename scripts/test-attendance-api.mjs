/**
 * Standalone Node.js script to directly test SUNAN Moodle APIs for attendance data.
 * Run with: node --experimental-fetch scripts/test-attendance-api.mjs <MOODLE_TOKEN>
 * 
 * If you don't have a token, first get one:
 * curl "https://sunan.umk.ac.id/login/token.php?username=NIM&password=PASS&service=moodle_mobile_app"
 */

const MOODLE_BASE_URL = 'https://sunan.umk.ac.id';
const token = process.argv[2];

if (!token) {
  console.error('Usage: node scripts/test-attendance-api.mjs <MOODLE_TOKEN>');
  console.error('Get token: curl "https://sunan.umk.ac.id/login/token.php?username=NIM&password=PASS&service=moodle_mobile_app"');
  process.exit(1);
}

function appendParam(ps, key, value) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => appendParam(ps, `${key}[${i}]`, item));
    return;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([k, v]) => appendParam(ps, `${key}[${k}]`, v));
    return;
  }
  ps.append(key, String(value));
}

async function callMoodle(fn, params = {}) {
  const body = new URLSearchParams();
  body.append('wstoken', token);
  body.append('wsfunction', fn);
  body.append('moodlewsrestformat', 'json');
  Object.entries(params).forEach(([k, v]) => appendParam(body, k, v));

  const res = await fetch(`${MOODLE_BASE_URL}/webservice/rest/server.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return res.json();
}

function ts(unix) {
  return new Date(unix * 1000).toISOString();
}

async function main() {
  const now = Math.floor(Date.now() / 1000);
  console.log(`\n=== SUNAN Attendance API Diagnostic ===`);
  console.log(`Now: ${ts(now)} (${now})\n`);

  // Step 1: Get site info
  console.log('--- 1. Site Info ---');
  const siteInfo = await callMoodle('core_webservice_get_site_info');
  if (siteInfo.exception) {
    console.error('Token invalid:', siteInfo.message);
    process.exit(1);
  }
  console.log(`User: ${siteInfo.fullname} (ID: ${siteInfo.userid})`);
  // Check available functions
  const fns = (siteInfo.functions || []).map(f => f.name);
  const attFns = fns.filter(f => f.includes('attendance'));
  console.log(`Attendance-related functions available: ${attFns.length > 0 ? attFns.join(', ') : 'NONE'}`);
  console.log(`Total functions: ${fns.length}`);

  // Step 2: Get courses
  console.log('\n--- 2. Courses ---');
  const courses = await callMoodle('core_enrol_get_users_courses', { userid: siteInfo.userid });
  const courseIds = courses.map(c => c.id);
  console.log(`Courses: ${courses.length}`);
  courses.forEach(c => console.log(`  id=${c.id} "${c.fullname}"`));

  // Step 3: Test mod_attendance APIs
  console.log('\n--- 3. mod_attendance_get_courses_with_today_sessions ---');
  try {
    const todaySessions = await callMoodle('mod_attendance_get_courses_with_today_sessions');
    console.log(`Response: ${JSON.stringify(todaySessions).slice(0, 3000)}`);
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  // Step 4: Find attendance modules in courses
  console.log('\n--- 4. Finding attendance modules in courses ---');
  for (const courseId of courseIds.slice(0, 8)) {
    try {
      const sections = await callMoodle('core_course_get_contents', { courseid: courseId });
      if (Array.isArray(sections)) {
        for (const section of sections) {
          for (const mod of (section.modules || [])) {
            if (mod.modname === 'attendance') {
              const courseName = courses.find(c => c.id === courseId)?.fullname || courseId;
              console.log(`\n  FOUND attendance in "${courseName}": module_id=${mod.id} instance=${mod.instance} name="${mod.name}"`);
              
              // Try to get sessions
              try {
                const sessions = await callMoodle('mod_attendance_get_sessions', { attendanceid: mod.instance });
                if (Array.isArray(sessions)) {
                  console.log(`    Sessions count: ${sessions.length}`);
                  // Show sessions around today
                  const todayStart = now - 12 * 3600;
                  const todayEnd = now + 24 * 3600;
                  const todaySessions = sessions.filter(s => 
                    s.sessdate >= todayStart && s.sessdate <= todayEnd
                  );
                  console.log(`    Sessions today/nearby: ${todaySessions.length}`);
                  todaySessions.forEach(s => {
                    console.log(`      session_id=${s.id} date=${ts(s.sessdate)} duration=${s.duration}s description="${s.description || ''}" statusset="${s.statusset || ''}"`);
                  });
                  // Show next 5 upcoming sessions
                  const upcoming = sessions.filter(s => s.sessdate >= now).slice(0, 5);
                  console.log(`    Next 5 upcoming sessions:`);
                  upcoming.forEach(s => {
                    console.log(`      session_id=${s.id} date=${ts(s.sessdate)} duration=${s.duration}s`);
                  });
                } else {
                  console.log(`    Sessions response: ${JSON.stringify(sessions).slice(0, 1000)}`);
                }
              } catch (e) {
                console.log(`    mod_attendance_get_sessions error: ${e.message || JSON.stringify(e)}`);
              }
            }
          }
        }
      }
    } catch (e) {
      // Skip
    }
  }

  // Step 5: Calendar events
  console.log('\n--- 5. Calendar Events (attendance-related only) ---');
  const timeStart = now - 2 * 24 * 3600;
  const timeEnd = now + 30 * 24 * 3600;
  
  try {
    const calData = await callMoodle('core_calendar_get_calendar_events', {
      events: { courseids: courseIds },
      options: { timestart: timeStart, timeend: timeEnd, userevents: false, siteevents: false, ignorehidden: true },
    });
    const events = Array.isArray(calData.events) ? calData.events : 
                   (calData.events && typeof calData.events === 'object') ? Object.values(calData.events) : [];
    console.log(`Total calendar events: ${events.length}`);
    const attEvents = events.filter(e => 
      (e.modulename || '').includes('attendance') || 
      (e.eventtype || '').includes('attendance') ||
      (e.name || '').toLowerCase().includes('absensi') ||
      (e.name || '').toLowerCase().includes('daftar hadir') ||
      (e.name || '').toLowerCase().includes('attendance') ||
      (e.name || '').toLowerCase().includes('presensi') ||
      (e.url || '').includes('/mod/attendance/')
    );
    console.log(`Attendance-related events: ${attEvents.length}`);
    attEvents.forEach(e => {
      console.log(`  id=${e.id} name="${e.name}" mod=${e.modulename || '?'} type=${e.eventtype || '?'} ts=${ts(e.timestart)} dur=${e.timeduration} url=${e.url || 'none'}`);
    });
    if (attEvents.length === 0) {
      console.log(`  (showing first 10 of all ${events.length} events for reference)`);
      events.slice(0, 10).forEach(e => {
        console.log(`  id=${e.id} name="${e.name}" mod=${e.modulename || '?'} type=${e.eventtype || '?'} ts=${ts(e.timestart)}`);
      });
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  // Step 6: Upcoming view
  console.log('\n--- 6. Upcoming Calendar View ---');
  try {
    const upcoming = await callMoodle('core_calendar_get_calendar_upcoming_view');
    const events = Array.isArray(upcoming.events) ? upcoming.events : [];
    console.log(`Upcoming events: ${events.length}`);
    events.forEach(e => {
      console.log(`  id=${e.id} name="${e.name}" mod=${e.modulename || '?'} type=${e.eventtype || '?'} ts=${ts(e.timestart)} url=${e.url || 'none'}`);
    });
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  console.log('\n=== END DIAGNOSTIC ===\n');
}

main().catch(e => console.error('Fatal:', e));
