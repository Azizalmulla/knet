const fs = require('fs');
const path = require('path');

function checkFileExists(filePath, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  const exists = fs.existsSync(fullPath);
  console.log(`${exists ? '✅' : '❌'} ${description}: ${filePath}`);
  return exists;
}

function verifySetup() {
  console.log('🔍 Verifying Careerly Complete Setup...\n');
  
  let allGood = true;
  
  // Core files
  console.log('📁 Core Files:');
  allGood &= checkFileExists('migrations/complete-careerly-schema.sql', 'Database Schema');
  allGood &= checkFileExists('lib/watheefti-fields.ts', 'Watheefti Fields');
  allGood &= checkFileExists('middleware.ts', 'Middleware');
  
  // Super Admin
  console.log('\n👑 Super Admin:');
  allGood &= checkFileExists('app/super-admin/login/page.tsx', 'Super Admin Login');
  allGood &= checkFileExists('app/super-admin/page.tsx', 'Super Admin Dashboard');
  allGood &= checkFileExists('app/api/super-admin/login/route.ts', 'Super Admin API');
  allGood &= checkFileExists('app/api/super-admin/organizations/route.ts', 'Organizations API');
  
  // Multi-tenant routes
  console.log('\n🏢 Multi-tenant Routes:');
  allGood &= checkFileExists('app/[org]/start/page.tsx', 'Org Start Page');
  allGood &= checkFileExists('app/[org]/admin/login/page.tsx', 'Org Admin Login');
  allGood &= checkFileExists('app/[org]/admin/page.tsx', 'Org Admin Dashboard');
  
  // Components
  console.log('\n🧩 Components:');
  allGood &= checkFileExists('components/watheefti-upload-form.tsx', 'Watheefti Form');
  allGood &= checkFileExists('components/ui/checkbox.tsx', 'Checkbox Component');
  allGood &= checkFileExists('app/start/company-picker.tsx', 'Company Picker');
  
  // API Routes
  console.log('\n🔌 API Routes:');
  allGood &= checkFileExists('app/api/[org]/admin/login/route.ts', 'Org Admin Auth');
  allGood &= checkFileExists('app/api/organizations/public/route.ts', 'Public Orgs API');
  
  // Documentation
  console.log('\n📚 Documentation:');
  allGood &= checkFileExists('COMPLETE-SETUP.md', 'Setup Guide');
  allGood &= checkFileExists('docs/MASTER-SETUP-GUIDE.md', 'Master Guide');
  allGood &= checkFileExists('docs/PER-ORG-ADMIN-AUTH.md', 'Auth Guide');
  
  // Scripts
  console.log('\n🛠️ Scripts:');
  allGood &= checkFileExists('scripts/run-complete-migration.js', 'Migration Runner');
  allGood &= checkFileExists('scripts/seed-admin.ts', 'Admin Seeder');
  
  // Check package.json dependencies
  console.log('\n📦 Dependencies:');
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    const required = [
      'jsonwebtoken',
      'bcryptjs', 
      'qrcode',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@types/jsonwebtoken',
      '@types/bcryptjs',
      '@types/qrcode'
    ];
    
    required.forEach(dep => {
      const installed = deps[dep] ? '✅' : '❌';
      console.log(`${installed} ${dep}`);
      if (!deps[dep]) allGood = false;
    });
  } catch (error) {
    console.log('❌ Could not read package.json');
    allGood = false;
  }
  
  // Environment check
  console.log('\n🔧 Environment:');
  const envPath = path.join(__dirname, '..', '.env.local');
  const hasEnv = fs.existsSync(envPath);
  console.log(`${hasEnv ? '✅' : '⚠️'} .env.local file ${hasEnv ? 'exists' : 'missing (create manually)'}`);
  
  if (hasEnv) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const hasDB = envContent.includes('DATABASE_URL') || envContent.includes('POSTGRES_URL');
      const hasJWT = envContent.includes('JWT_SECRET');
      console.log(`${hasDB ? '✅' : '❌'} Database URL configured`);
      console.log(`${hasJWT ? '✅' : '❌'} JWT Secret configured`);
      if (!hasDB || !hasJWT) allGood = false;
    } catch (error) {
      console.log('❌ Could not read .env.local');
    }
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (allGood) {
    console.log('\n🎉 Setup Verification: PASSED');
    console.log('\n✅ All components are in place!');
    console.log('\n📋 Next Steps:');
    console.log('1. Configure .env.local with DATABASE_URL and JWT_SECRET');
    console.log('2. Run: node scripts/run-complete-migration.js');
    console.log('3. Start: npm run dev');
    console.log('4. Visit: http://localhost:3000/super-admin/login');
  } else {
    console.log('\n❌ Setup Verification: FAILED');
    console.log('\n🔧 Some components are missing. Please check the errors above.');
  }
  
  console.log('\n' + '='.repeat(50));
}

verifySetup();
