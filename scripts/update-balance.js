// Direct balance update script for Supabase
const { createClient } = require('@supabase/supabase-js');

// Supabase connection
const supabaseUrl = 'https://hyiwhckxwrngegswagrb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aXdoY2t4d3JuZ2Vnc3dhZ3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0OTY4MzcsImV4cCI6MjA2MTA3MjgzN30.bpDSX9CUEA0F99x3cwNbeTVTVq-NHw5GC5jmp2QqnNM';

// Create Supabase client with specific options
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Account to update
const accountNumber = '02.1.0006'; // Galih Aghni Wicaksono
const newBalance = 123456789;

async function main() {
  try {
    console.log(`Attempting to update balance for account ${accountNumber} to ${newBalance}`);
    
    // Step 1: Get the current account data
    const { data: account, error: getError } = await supabase
      .from('anggota')
      .select('*')
      .eq('nomor_rekening', accountNumber)
      .single();
    
    if (getError) {
      console.error('Error getting account:', getError);
      process.exit(1);
    }
    
    console.log('Current account data:', account);
    console.log(`Current balance: ${account.saldo}`);
    
    // Step 2: Try multiple update approaches
    
    // Approach 1: Direct update by nomor_rekening
    console.log('\nApproach 1: Direct update by nomor_rekening');
    const { data: update1, error: error1 } = await supabase
      .from('anggota')
      .update({ 
        saldo: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('nomor_rekening', accountNumber)
      .select();
    
    console.log('Result:', error1 ? 'Failed' : 'Success');
    if (error1) console.error('Error:', error1);
    else console.log('Updated data:', update1);
    
    // Approach 2: Direct update by ID
    console.log('\nApproach 2: Direct update by ID');
    const { data: update2, error: error2 } = await supabase
      .from('anggota')
      .update({ 
        saldo: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', account.id)
      .select();
    
    console.log('Result:', error2 ? 'Failed' : 'Success');
    if (error2) console.error('Error:', error2);
    else console.log('Updated data:', update2);
    
    // Approach 3: Upsert
    console.log('\nApproach 3: Upsert');
    const { data: update3, error: error3 } = await supabase
      .from('anggota')
      .upsert({
        id: account.id,
        nomor_rekening: accountNumber,
        saldo: newBalance,
        updated_at: new Date().toISOString()
      })
      .select();
    
    console.log('Result:', error3 ? 'Failed' : 'Success');
    if (error3) console.error('Error:', error3);
    else console.log('Updated data:', update3);
    
    // Approach 4: Insert with on_conflict
    console.log('\nApproach 4: Insert with on_conflict');
    const { data: update4, error: error4 } = await supabase
      .from('anggota')
      .insert({
        id: account.id,
        nomor_rekening: accountNumber,
        nama: account.nama,
        saldo: newBalance,
        alamat: account.alamat,
        kota: account.kota,
        tempat_lahir: account.tempat_lahir,
        tanggal_lahir: account.tanggal_lahir,
        pekerjaan: account.pekerjaan,
        jenis_identitas: account.jenis_identitas,
        nomor_identitas: account.nomor_identitas,
        is_active: account.is_active,
        created_at: account.created_at,
        updated_at: new Date().toISOString()
      })
      .onConflict('id')
      .merge(['saldo', 'updated_at'])
      .select();
    
    console.log('Result:', error4 ? 'Failed' : 'Success');
    if (error4) console.error('Error:', error4);
    else console.log('Updated data:', update4);
    
    // Final verification
    console.log('\nFinal verification:');
    const { data: finalAccount, error: finalError } = await supabase
      .from('anggota')
      .select('*')
      .eq('nomor_rekening', accountNumber)
      .single();
    
    if (finalError) {
      console.error('Error getting final account data:', finalError);
    } else {
      console.log('Final account data:', finalAccount);
      console.log(`Final balance: ${finalAccount.saldo}`);
      
      if (finalAccount.saldo === newBalance) {
        console.log('\n✅ SUCCESS: Balance successfully updated!');
      } else {
        console.log('\n❌ FAILED: Balance not updated correctly.');
        console.log(`Expected: ${newBalance}, Actual: ${finalAccount.saldo}`);
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

// Run the main function
main();
