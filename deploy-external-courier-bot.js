const fs = require('fs');
const https = require('https');

const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'igzoxnzdqwongmyvkxww';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_ACCESS_TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN environment variable is required');
  process.exit(1);
}

const functionCode = fs.readFileSync('./supabase/functions/external-courier-registration-bot/index.ts', 'utf-8');

const payload = JSON.stringify({
  slug: 'external-courier-registration-bot',
  name: 'external-courier-registration-bot',
  verify_jwt: false,
  import_map: false,
  entrypoint_path: 'index.ts',
  files: [
    {
      name: 'index.ts',
      content: functionCode
    }
  ]
});

const options = {
  hostname: 'api.supabase.com',
  port: 443,
  path: `/v1/projects/${SUPABASE_PROJECT_REF}/functions`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Function deployed successfully!');
      console.log(data);
    } else {
      console.error('❌ Deployment failed:', res.statusCode);
      console.error(data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error deploying function:', error);
  process.exit(1);
});

req.write(payload);
req.end();
