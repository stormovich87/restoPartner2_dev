const fs = require('fs');
const https = require('https');

const projectRef = 'igzoxnzdqwongmyvkxww';
const functionSlug = 'courier-accept-webhook';
const indexPath = './supabase/functions/courier-accept-webhook/index.ts';

const content = fs.readFileSync(indexPath, 'utf8');

const data = JSON.stringify({
  slug: functionSlug,
  name: functionSlug,
  verify_jwt: false,
  entrypoint_path: 'index.ts',
  files: [
    {
      name: 'index.ts',
      content: content
    }
  ]
});

const options = {
  hostname: `${projectRef}.supabase.co`,
  port: 443,
  path: '/functions/v1/' + functionSlug,
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`
  }
};

console.log('Deploying function...');
console.log('Project:', projectRef);
console.log('Function:', functionSlug);

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);

  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('Response:', responseData);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('✅ Function deployed successfully!');
    } else {
      console.error('❌ Deployment failed');
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
  process.exit(1);
});

req.write(data);
req.end();
