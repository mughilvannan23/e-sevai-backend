const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { sendOTP } = require('../utils/email');

/**
 * Generate 6 digit numeric OTP
 */
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Get admin credentials from environment variables
 */
const getAdminCredentials = () => {
  return {
    email: process.env.ADMIN_EMAIL?.toLowerCase().trim() || null,
    password: process.env.ADMIN_PASSWORD?.trim() || null,
    passwordHash: process.env.ADMIN_PASSWORD_HASH?.trim() || null
  };
};

/**
 * ✅ ADMIN LOGIN - Direct login without OTP
 */
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 🐛 DEBUG LOGS
    console.log('\n🔑 ADMIN LOGIN ATTEMPT');
    console.log('📧 Input email:', email);
    console.log('🔑 Input password provided:', !!password);

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Get configured admin email from environment
    const configuredAdminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
    
    console.log('⚙️ Configured admin email:', configuredAdminEmail);

    // Normalize input email
    const normalizedEmail = email.toLowerCase().trim();

    // 🔍 Step 1: Match email with configured admin
    if (normalizedEmail !== configuredAdminEmail) {
      console.log('❌ Email mismatch: input does not match configured admin');
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // 🔍 Step 2: Find admin user in database
    let adminUser = await User.findOne({ 
      email: configuredAdminEmail, 
      role: 'admin',
      isActive: true 
    }).select('+password');

    console.log('👤 Admin user found in DB:', adminUser ? 'YES' : 'NO');

    if (!adminUser) {
      // ✅ Create admin user with configured credentials
      console.log('⚙️ Creating admin user in database...');
      
      const configuredPassword = process.env.ADMIN_PASSWORD.trim();
      
      adminUser = new User({
        name: 'System Administrator',
        email: configuredAdminEmail,
        password: configuredPassword,
        role: 'admin',
        isActive: true
      });

      await adminUser.save();
      console.log('✅ Admin user created successfully with configured email');
    }

    // 🔑 Step 3: Verify password
    const isPasswordValid = await adminUser.comparePassword(password.trim());
    
    console.log('🔐 Password match:', isPasswordValid ? '✅ VALID' : '❌ INVALID');

    if (!isPasswordValid) {
      console.log('❌ Password verification failed');
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // ✅ Password verified successfully - Generate JWT token directly
    adminUser.lastLogin = new Date();
    await adminUser.save();

    // Generate JWT Token
    const token = adminUser.generateAuthToken();

    console.log(`✅ Admin login successful: ${normalizedEmail}`);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        lastLogin: adminUser.lastLogin
      }
    });

  } catch (error) {
    console.error('❌ Admin login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

/**
 * ✅ VERIFY OTP - Complete admin login
 */
const verifyAdminOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate input
    if (!email || !otp || otp.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Valid email and 6-digit OTP are required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find valid OTP record
    const otpRecord = await OTP.findOne({
      email: normalizedEmail,
      purpose: 'login',
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired or is invalid'
      });
    }

    // Increment attempt counter
    otpRecord.attempts += 1;
    await otpRecord.save();

    // Check maximum attempts (3 tries allowed)
    if (otpRecord.attempts > 3) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: 'Too many attempts. Please request new OTP.'
      });
    }

    // Verify OTP matches
    if (otpRecord.otp !== otp.trim()) {
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${3 - otpRecord.attempts} attempts remaining.`
      });
    }

    // ✅ OTP Verified successfully

    // Delete used OTP permanently
    await OTP.deleteOne({ _id: otpRecord._id });

    // Get or create admin user in database
    let adminUser = await User.findOne({ email: normalizedEmail, role: 'admin' });

    if (!adminUser) {
      // Create admin user if not exists
      const configuredPassword = process.env.ADMIN_PASSWORD.trim();
      
      adminUser = new User({
        name: 'System Administrator',
        email: normalizedEmail,
        password: configuredPassword,
        role: 'admin',
        isActive: true
      });

      await adminUser.save();
    }

    // Update last login timestamp
    adminUser.lastLogin = new Date();
    await adminUser.save();

    // Generate JWT Token
    const token = adminUser.generateAuthToken();

    console.log(`✅ Admin login successful: ${normalizedEmail}`);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        lastLogin: adminUser.lastLogin
      }
    });

  } catch (error) {
    console.error('❌ OTP verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during OTP verification'
    });
  }
};

/**
 * ✅ EMPLOYEE LOGIN
 */
const employeeLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find active employee
    const user = await User.findOne({ 
      email: email.toLowerCase().trim(), 
      role: 'employee',
      isActive: true 
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password.trim());

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT Token
    const token = user.generateAuthToken();

    console.log(`✅ Employee login: ${user.email}`);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        employeeId: user.employeeId,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('❌ Employee login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

/**
 * ✅ GET CURRENT USER PROFILE
 */
const getProfile = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        employeeId: req.user.employeeId,
        lastLogin: req.user.lastLogin
      }
    });
  } catch (error) {
    console.error('❌ Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
};

/**
 * ✅ LOGOUT
 */
const logout = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
};

module.exports = {
  adminLogin,
  verifyAdminOTP,
  employeeLogin,
  getProfile,
  logout
};