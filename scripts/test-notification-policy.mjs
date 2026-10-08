import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const typescript = require('typescript');

async function loadTypeScriptModule(relativePath) {
  const filePath = fileURLToPath(new URL(relativePath, import.meta.url));
  const source = await readFile(filePath, 'utf8');
  const result = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
      strict: true,
    },
    fileName: filePath,
    reportDiagnostics: true,
  });

  const diagnostics = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === typescript.DiagnosticCategory.Error
  );
  assert.equal(
    diagnostics.length,
    0,
    diagnostics.map((diagnostic) => String(diagnostic.messageText)).join('\n')
  );

  const module = { exports: {} };
  new Function('exports', 'module', result.outputText)(module.exports, module);
  return module.exports;
}

const quietHours = await loadTypeScriptModule('../lib/utils/quietHours.ts');
const deliveryPolicy = await loadTypeScriptModule(
  '../../supabase/functions/_shared/notification-policy.ts'
);

const overnightQuietHours = { enabled: true, start: '22:00', end: '07:00' };
const overnightServerSettings = {
  jam_diam_aktif: true,
  jangan_ganggu_mulai: '22:00:00',
  jangan_ganggu_selesai: '07:00:00',
};

const evening = new Date('2026-10-03T16:00:00.000Z'); // 23:00 WIB
const morning = new Date('2026-10-02T22:00:00.000Z'); // 05:00 WIB
const outsideQuietHours = new Date('2026-10-03T07:00:00.000Z'); // 14:00 WIB

assert.equal(
  quietHours.getQuietHoursEndDate(evening, overnightQuietHours)?.toISOString(),
  '2026-10-04T00:00:00.000Z'
);
assert.equal(
  deliveryPolicy.getQuietHoursEndDate(overnightServerSettings, evening)?.toISOString(),
  '2026-10-04T00:00:00.000Z'
);
assert.equal(
  quietHours.getQuietHoursEndDate(morning, overnightQuietHours)?.toISOString(),
  '2026-10-03T00:00:00.000Z'
);
assert.equal(
  deliveryPolicy.getQuietHoursEndDate(overnightServerSettings, morning)?.toISOString(),
  '2026-10-03T00:00:00.000Z'
);
assert.equal(quietHours.getQuietHoursEndDate(outsideQuietHours, overnightQuietHours), null);
assert.equal(deliveryPolicy.getQuietHoursEndDate(overnightServerSettings, outsideQuietHours), null);
assert.equal(
  quietHours.getQuietHoursEndDate(evening, { enabled: true, start: '08:00', end: '08:00' }),
  null
);
assert.equal(
  quietHours.isQuietHoursConfigurationValid({ enabled: true, start: '22:00', end: '07:00' }),
  true
);
assert.equal(
  quietHours.isQuietHoursConfigurationValid({ enabled: true, start: '22:99', end: '07:00' }),
  false
);

const retryNow = new Date('2026-10-03T00:00:00.000Z');
const firstFailure = deliveryPolicy.getDeliveryFailureState(0, retryNow);
assert.equal(firstFailure.attempts, 1);
assert.equal(firstFailure.terminal, false);
assert.equal(firstFailure.retryAt?.toISOString(), '2026-10-03T00:15:00.000Z');

const thirdFailure = deliveryPolicy.getDeliveryFailureState(2, retryNow);
assert.equal(thirdFailure.attempts, 3);
assert.equal(thirdFailure.retryAt?.toISOString(), '2026-10-03T01:00:00.000Z');

const terminalFailure = deliveryPolicy.getDeliveryFailureState(4, retryNow);
assert.equal(terminalFailure.attempts, deliveryPolicy.MAX_DELIVERY_ATTEMPTS);
assert.equal(terminalFailure.terminal, true);
assert.equal(terminalFailure.retryAt, null);

console.log('Notification policy checks passed.');
