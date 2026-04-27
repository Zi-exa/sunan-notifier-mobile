const { spawn } = require('child_process');
const path = require('path');

const requestedArgs = process.argv.slice(2);
const useTunnel = requestedArgs.includes('--tunnel');

function shouldFallbackToLan(output) {
  return (
    output.includes("Cannot read properties of undefined (reading 'body')") ||
    output.includes('Check the Ngrok status page for outages')
  );
}

function runExpo(args, options = {}) {
  return new Promise((resolve) => {
    const expoCliPath = require.resolve(path.join('expo', 'bin', 'cli'));
    const captureStderr = options.captureStderr === true;
    const child = spawn(process.execPath, [expoCliPath, 'start', ...args], {
      stdio: captureStderr ? ['inherit', 'inherit', 'pipe'] : 'inherit',
      env: process.env,
      cwd: process.cwd(),
    });

    let combinedOutput = '';

    if (captureStderr && child.stderr) {
      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        combinedOutput += text;
        process.stderr.write(text);
      });
    }

    child.on('close', (code) => {
      resolve({ code: code ?? 0, output: combinedOutput });
    });
  });
}

async function main() {
  const firstRun = await runExpo(requestedArgs, { captureStderr: useTunnel });

  if (useTunnel && firstRun.code !== 0 && shouldFallbackToLan(firstRun.output)) {
    const lanArgs = requestedArgs.filter((arg) => arg !== '--tunnel');
    if (!lanArgs.includes('--lan')) {
      lanArgs.push('--lan');
    }

    process.stdout.write(
      '\nTunnel Expo sedang bermasalah. Menjalankan ulang dengan LAN...\n\n'
    );

    const secondRun = await runExpo(lanArgs);
    process.exit(secondRun.code);
  }

  process.exit(firstRun.code);
}

void main();
