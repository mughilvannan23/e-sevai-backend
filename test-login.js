require('dotenv').config();
const { testEmailConnection, sendOTP } = require('./utils/email');

const testSendGrid = async () => {
  try {
    console.log('\n🧪 Testing SendGrid connection...\n');
    
    // Test connection
    const connected = await testEmailConnection();
    if (!connected) {
      console.log('❌ SendGrid connection failed');
      process.exit(1);
    }

    console.log('\n📧 Sending test OTP...\n');
    
    // Send OTP
    await sendOTP('sudharsanp300@gmail.com', '123456');
    
    console.log('\n✅ Test OTP email sent successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message, '\n');
    process.exit(1);
  }
};

testSendGrid();
