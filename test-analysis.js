// Quick test script to verify analysis setup
require('dotenv').config({ path: '.env.local' });

console.log('=== Analysis Configuration Check ===\n');

// Check 1: API Key
const apiKey = process.env.OPENROUTER_API_KEY;
if (apiKey) {
    console.log('✅ OPENROUTER_API_KEY is set');
    console.log(`   Length: ${apiKey.length} characters`);
    console.log(`   Starts with: ${apiKey.substring(0, 10)}...`);
} else {
    console.log('❌ OPENROUTER_API_KEY is NOT set');
    console.log('   Please add it to your .env.local file');
}

// Check 2: MongoDB Connection
const mongoUri = process.env.MONGODB_URI;
if (mongoUri) {
    console.log('\n✅ MONGODB_URI is set');
    console.log(`   URI: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);
} else {
    console.log('\n⚠️  MONGODB_URI not set (will use default)');
}

// Check 3: Test AI Connection
if (apiKey) {
    console.log('\n=== Testing AI Connection ===');
    const OpenAI = require('openai');

    const openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: apiKey,
        defaultHeaders: {
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Risk Analysis Tool",
        },
    });

    console.log('Sending test request to OpenRouter...');

    openai.chat.completions.create({
        model: 'openrouter/sherlock-dash-alpha',
        messages: [
            { role: 'system', content: 'You are a test assistant.' },
            { role: 'user', content: 'Say "OK" if you can read this.' },
        ],
        temperature: 0.7,
        max_tokens: 10
    }).then(response => {
        console.log('✅ AI Connection successful!');
        console.log(`   Response: ${response.choices[0].message.content}`);
    }).catch(error => {
        console.log('❌ AI Connection failed!');
        console.log(`   Error: ${error.message}`);
        if (error.status === 401) {
            console.log('   → API key is invalid or expired');
        } else if (error.status === 402) {
            console.log('   → Insufficient credits on OpenRouter account');
        }
    });
} else {
    console.log('\n⚠️  Skipping AI test (no API key)');
}
