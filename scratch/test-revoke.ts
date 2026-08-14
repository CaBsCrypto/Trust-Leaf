import { getDoctorAddress, getDispensaryAddress } from '../api/_lib/stellar';

async function testRevokeEndpoints() {
  const doctorAddress = "GD2MXRXHYBSSY7CXQWAYN5S7OHAUVEULPHV4SYQA3542GIQLUGJ57VNX";
  const dispensaryAddress = "GCJLFG6PX6OA6JBJPQP2PXBJ7SD726O4R46IMWD4GBK3CX7HCWEJZRJ6";

  console.log('Testing revoke-doctor endpoint...');
  try {
    const res = await fetch('http://localhost:3000/api/stellar/admin/revoke-doctor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorAddress })
    });
    console.log('revoke-doctor status:', res.status);
    console.log('revoke-doctor response:', await res.json());
  } catch (err) {
    console.error('Error calling revoke-doctor:', err);
  }

  console.log('\nTesting revoke-dispensary endpoint...');
  try {
    const res = await fetch('http://localhost:3000/api/stellar/admin/revoke-dispensary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dispensaryAddress })
    });
    console.log('revoke-dispensary status:', res.status);
    console.log('revoke-dispensary response:', await res.json());
  } catch (err) {
    console.error('Error calling revoke-dispensary:', err);
  }
}

testRevokeEndpoints();
