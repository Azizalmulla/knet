import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const prompt = (question: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

async function seedAdmin() {
  try {
    console.log('🔧 Admin User Creation Tool\n');
    
    // Get organization slug
    const orgSlug = await prompt('Organization slug (e.g., knet, nbk): ') || 'careerly';
    
    // Check if org exists or create it
    let orgResult = await sql`
      SELECT id, name FROM organizations WHERE slug = ${orgSlug} LIMIT 1
    `;
    
    let orgId: string;
    let orgName: string;
    
    if (!orgResult.rows.length) {
      // Create new organization
      const newOrgName = await prompt('Organization name: ') || orgSlug;
      const isPublic = (await prompt('Public organization? (y/n): ')).toLowerCase() === 'y';
      const companyCode = !isPublic ? await prompt('Company code (6-8 chars): ') : null;
      
      const createResult = await sql`
        INSERT INTO organizations (slug, name, is_public, company_code)
        VALUES (${orgSlug}, ${newOrgName}, ${isPublic}, ${companyCode})
        RETURNING id, name
      `;
      
      orgId = createResult.rows[0].id;
      orgName = createResult.rows[0].name;
      console.log(`✅ Created organization: ${orgName}`);
    } else {
      orgId = orgResult.rows[0].id;
      orgName = orgResult.rows[0].name;
      console.log(`✅ Using existing organization: ${orgName}`);
    }
    
    // Get admin details
    const email = await prompt('Admin email: ') || `admin@${orgSlug}.com`;
    const password = await prompt('Admin password: ') || 'admin123';
    const role = await prompt('Role (owner/admin/viewer) [admin]: ') || 'admin';
    
    // Hash password with bcrypt (12 rounds for security)
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create or update admin user
    await sql`
      INSERT INTO admin_users (organization_id, email, password_hash, role)
      VALUES (${orgId}::uuid, ${email}, ${passwordHash}, ${role})
      ON CONFLICT (organization_id, email_lc) 
      DO UPDATE SET 
        password_hash = ${passwordHash},
        role = ${role}
    `;
    
    console.log('\n✅ Admin user created successfully!\n');
    console.log('📋 Login Details:');
    console.log('─'.repeat(40));
    console.log(`Organization: ${orgName} (${orgSlug})`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Role: ${role}`);
    console.log('─'.repeat(40));
    console.log(`\n🔗 Login URL: http://localhost:3000/${orgSlug}/admin/login`);
    console.log(`📊 Dashboard: http://localhost:3000/${orgSlug}/admin`);
    
    // Create additional test admins for common orgs
    const createTestAdmins = (await prompt('\nCreate test admins for other orgs? (y/n): ')).toLowerCase() === 'y';
    
    if (createTestAdmins) {
      const testOrgs = ['knet', 'nbk', 'zain'];
      
      for (const testSlug of testOrgs) {
        if (testSlug === orgSlug) continue;
        
        const testOrgRes = await sql`
          SELECT id, name FROM organizations WHERE slug = ${testSlug} LIMIT 1
        `;
        
        if (testOrgRes.rows.length) {
          const testEmail = `admin@${testSlug}.com`;
          const testPassword = 'test123';
          const testHash = await bcrypt.hash(testPassword, 12);
          
          await sql`
            INSERT INTO admin_users (organization_id, email, password_hash, role)
            VALUES (${testOrgRes.rows[0].id}::uuid, ${testEmail}, ${testHash}, 'admin')
            ON CONFLICT (organization_id, email_lc) DO NOTHING
          `;
          
          console.log(`✅ Created test admin for ${testSlug}: ${testEmail} / ${testPassword}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  
  rl.close();
  process.exit(0);
}

// Check for required environment variables
if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
  console.error('❌ Database connection not configured.');
  console.error('Please set DATABASE_URL or POSTGRES_URL environment variable.');
  process.exit(1);
}

seedAdmin();
