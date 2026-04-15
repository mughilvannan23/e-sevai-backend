const axios = require('axios');

const testAdminLogin = async () => {
  try {
    console.log('🔑 Testing admin login...');
    const response = await axios.post('http://localhost:5000/api/auth/admin/login', {
      email: 'sudharsanp300@gmail.com',
      password: 'admin@123'
    });

    console.log('✅ Login successful');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Login failed');
    console.error('Error:', error.response?.data || error.message);
  }
};

testAdminLogin();
