#!/usr/bin/env node
/**
 * Script to validate Apple Music environment variables
 * Run with: node scripts/validate-apple-music-env.js
 */

// Simple env parser (since dotenv might not be installed)
const fs = require('fs');
const path = require('path');

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  
  content.split('\n').forEach((line, index) => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        let key = match[1].trim();
        let value = match[2].trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Handle multi-line values (if value ends with \ and next line exists)
        let nextLineIndex = index + 1;
        while (nextLineIndex < content.split('\n').length) {
          const nextLine = content.split('\n')[nextLineIndex].trim();
          if (nextLine && !nextLine.startsWith('#') && !nextLine.includes('=')) {
            value += '\n' + nextLine;
            nextLineIndex++;
          } else {
            break;
          }
        }
        
        env[key] = value;
      }
    }
  });
  
  return env;
}

try {
  const envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found');
    process.exit(1);
  }
  
  const env = parseEnvFile(envPath);
  
  console.log('🔍 Checking Apple Music environment variables...\n');
  
  // Check Team ID
  const teamId = env.APPLE_MUSIC_TEAM_ID;
  if (!teamId) {
    console.error('❌ APPLE_MUSIC_TEAM_ID is not set');
  } else if (teamId.length !== 10) {
    console.warn(`⚠️  APPLE_MUSIC_TEAM_ID length is ${teamId.length}, expected 10 characters`);
    console.log(`   Current value: ${teamId}`);
  } else {
    console.log(`✅ APPLE_MUSIC_TEAM_ID: ${teamId}`);
  }
  
  // Check Key ID
  const keyId = env.APPLE_MUSIC_KEY_ID;
  if (!keyId) {
    console.error('❌ APPLE_MUSIC_KEY_ID is not set');
  } else if (keyId.length !== 10) {
    console.warn(`⚠️  APPLE_MUSIC_KEY_ID length is ${keyId.length}, expected 10 characters`);
    console.log(`   Current value: ${keyId}`);
  } else {
    console.log(`✅ APPLE_MUSIC_KEY_ID: ${keyId}`);
  }
  
  // Check Private Key
  const privateKey = env.APPLE_MUSIC_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ APPLE_MUSIC_PRIVATE_KEY is not set');
  } else {
    // Check if it has escaped newlines
    const hasEscapedNewlines = privateKey.includes('\\n');
    const hasActualNewlines = privateKey.includes('\n') && !privateKey.includes('\\n');
    
    // Replace escaped newlines for validation
    const normalizedKey = privateKey.replace(/\\n/g, '\n');
    
    const hasBegin = normalizedKey.includes('-----BEGIN PRIVATE KEY-----');
    const hasEnd = normalizedKey.includes('-----END PRIVATE KEY-----');
    const keyLength = normalizedKey.length;
    
    console.log(`✅ APPLE_MUSIC_PRIVATE_KEY is set (length: ${keyLength} chars)`);
    
    if (!hasBegin) {
      console.error('   ❌ Missing -----BEGIN PRIVATE KEY-----');
    } else {
      console.log('   ✅ Contains BEGIN marker');
    }
    
    if (!hasEnd) {
      console.error('   ❌ Missing -----END PRIVATE KEY-----');
    } else {
      console.log('   ✅ Contains END marker');
    }
    
    if (hasEscapedNewlines) {
      console.log('   ✅ Uses escaped newlines (\\n) - correct format');
    } else if (hasActualNewlines) {
      console.log('   ⚠️  Uses actual newlines - may work but escaped format is recommended');
    } else {
      console.warn('   ⚠️  No newlines detected - key might be malformed');
    }
    
    // Check minimum length (should be at least 200 chars for a valid key)
    if (keyLength < 200) {
      console.warn(`   ⚠️  Key seems short (${keyLength} chars) - might be incomplete`);
    }
  }
  
  console.log('\n📋 Summary:');
  if (teamId && keyId && privateKey) {
    console.log('✅ All three variables are set');
    
    // Try to validate the key format
    const normalizedKey = privateKey.replace(/\\n/g, '\n');
    if (normalizedKey.includes('-----BEGIN PRIVATE KEY-----') && 
        normalizedKey.includes('-----END PRIVATE KEY-----')) {
      console.log('✅ Private key format looks correct');
      console.log('\n🎉 Your Apple Music environment variables appear to be correctly formatted!');
    } else {
      console.log('⚠️  Private key format may need adjustment');
    }
  } else {
    console.log('❌ Some variables are missing');
    console.log('\n💡 Make sure your .env file contains:');
    console.log('   APPLE_MUSIC_TEAM_ID=your_team_id');
    console.log('   APPLE_MUSIC_KEY_ID=your_key_id');
    console.log('   APPLE_MUSIC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"');
  }
  
} catch (error) {
  console.error('❌ Error validating environment variables:', error.message);
  process.exit(1);
}

